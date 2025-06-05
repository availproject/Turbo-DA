// SPDX-License-Identifier: UNLICENCSED
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MockERC20} from "../src/mocks/ERC20.sol";
import {TurboDAResolver} from "../src/TurboDAResolver.sol";
import {IERC20Errors} from "openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract TurboDAResolverTest is Test {
    using ECDSA for bytes32;

    TurboDAResolver public depositContract;
    MockERC20 public mockToken;

    address public user1;
    address public user2;

    uint256 public user1PrivateKey;
    uint256 public user2PrivateKey;

    uint256 public nonce;

    bytes32 public constant ORDER_ID_1 = keccak256("ORDER1");
    bytes32 public constant ORDER_ID_2 = keccak256("ORDER2");

    function _getPermitSignature(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint256 privateKey
    ) internal view returns (uint8, bytes32, bytes32) {
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                mockToken.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256(
                            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                        ),
                        owner,
                        spender,
                        value,
                        mockToken.nonces(owner),
                        deadline
                    )
                )
            )
        );

        return vm.sign(privateKey, permitHash);
    }

    function setUp() public {
        (user1, user1PrivateKey) = makeAddrAndKey("user1");
        (user2, user2PrivateKey) = makeAddrAndKey("user2");

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);

        depositContract = new TurboDAResolver();
        depositContract.initialize(user1, 3 days);

        mockToken = new MockERC20(
            "MockToken",
            "MTK",
            address(this),
            1000000 ether
        );
        vm.startPrank(user1);
        depositContract.grantRole(depositContract.OPERATOR_ROLE(), user1);
        depositContract.configureTokenValidity(address(mockToken), true);
        vm.stopPrank();
    }

    function testSuccessfulEthDeposit() public {
        uint256 depositAmount = 1 ether;

        vm.prank(user1);
        uint256 balanceBefore = address(depositContract).balance;
        depositContract.deposit{value: depositAmount}(ORDER_ID_1);
        uint256 balanceAfter = address(depositContract).balance;
        assertEq(
            balanceAfter - balanceBefore,
            depositAmount,
            "Deposit amount should match"
        );
    }

    function testRevertOnZeroEthDeposit() public {
        vm.prank(user1);
        vm.expectRevert(TurboDAResolver.InvalidAmount.selector);
        depositContract.deposit{value: 0}(ORDER_ID_1);
    }

    function testSuccessfulERC20Deposit() public {
        uint256 depositAmount = 100 ether;

        mockToken.mint(user1, depositAmount);

        vm.prank(user1);
        mockToken.approve(address(depositContract), depositAmount);

        uint256 balanceBefore = mockToken.balanceOf(address(depositContract));
        vm.prank(user1);
        depositContract.depositERC20(
            ORDER_ID_1,
            depositAmount,
            address(mockToken)
        );
        uint256 balanceAfter = mockToken.balanceOf(address(depositContract));
        assertEq(
            balanceAfter - balanceBefore,
            depositAmount,
            "Deposit amount should match"
        );
    }

    function testRevertOnZeroERC20Deposit() public {
        vm.prank(user1);
        vm.expectRevert(TurboDAResolver.InvalidAmount.selector);
        depositContract.depositERC20(ORDER_ID_1, 0, address(mockToken));
    }

    function testRevertOnUnauthorizedTokenDeposit() public {
        MockERC20 unauthorizedToken = new MockERC20(
            "UnauthorizedToken",
            "UTK",
            address(this),
            1000000 ether
        );

        uint256 depositAmount = 100 ether;
        unauthorizedToken.mint(user1, depositAmount);

        vm.prank(user1);
        unauthorizedToken.approve(address(depositContract), depositAmount);

        vm.prank(user1);
        vm.expectRevert(TurboDAResolver.InvalidTokenAddress.selector);
        depositContract.depositERC20(
            ORDER_ID_1,
            depositAmount,
            address(unauthorizedToken)
        );
    }

    function testRevertOnInsufficientAllowance() public {
        uint256 depositAmount = 100 ether;

        mockToken.mint(user1, depositAmount);

        vm.prank(user1);
        mockToken.approve(address(depositContract), depositAmount - 1);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(depositContract),
                depositAmount - 1,
                depositAmount
            )
        );
        depositContract.depositERC20(
            ORDER_ID_1,
            depositAmount,
            address(mockToken)
        );
    }

    function testMultipleDepositsForSameUser() public {
        uint256 firstDepositAmount = 50 ether;
        uint256 secondDepositAmount = 75 ether;

        mockToken.mint(user1, firstDepositAmount + secondDepositAmount);

        vm.startPrank(user1);
        uint256 balanceBefore = mockToken.balanceOf(address(depositContract));
        mockToken.approve(
            address(depositContract),
            firstDepositAmount + secondDepositAmount
        );

        depositContract.depositERC20(
            ORDER_ID_1,
            firstDepositAmount,
            address(mockToken)
        );

        depositContract.depositERC20(
            ORDER_ID_1,
            secondDepositAmount,
            address(mockToken)
        );
        vm.stopPrank();

        uint256 balanceAfter = mockToken.balanceOf(address(depositContract));
        assertEq(
            balanceAfter - balanceBefore,
            firstDepositAmount + secondDepositAmount,
            "Total deposit amount should match"
        );
    }

    // Test successful permit deposit
    function testSuccessfulPermitDeposit() public {
        uint256 depositAmount = 100 ether;
        uint256 deadline = block.timestamp + 1 days;

        mockToken.mint(user1, depositAmount);

        // Generate permit signature
        (uint8 v, bytes32 r, bytes32 s) = _getPermitSignature(
            user1,
            address(depositContract),
            depositAmount,
            deadline,
            user1PrivateKey
        );

        uint256 balanceBefore = mockToken.balanceOf(address(depositContract));

        // Perform permit deposit
        vm.prank(user1);
        depositContract.depositERC20WithPermit(
            ORDER_ID_1,
            depositAmount,
            deadline,
            address(mockToken),
            v,
            r,
            s
        );

        // Check deposit was recorded correctly
        uint256 balanceAfter = mockToken.balanceOf(address(depositContract));
        assertEq(
            balanceAfter - balanceBefore,
            depositAmount,
            "Deposit amount should match"
        );
    }

    // Test multiple permit deposits
    function testMultiplePermitDeposits() public {
        uint256 firstDepositAmount = 50 ether;
        uint256 secondDepositAmount = 75 ether;
        uint256 deadline = block.timestamp + 1 days;

        mockToken.mint(user1, firstDepositAmount + secondDepositAmount);

        // First permit deposit
        (uint8 v, bytes32 r, bytes32 s) = _getPermitSignature(
            user1,
            address(depositContract),
            firstDepositAmount,
            deadline,
            user1PrivateKey
        );
        uint256 balanceBefore = mockToken.balanceOf(address(depositContract));

        vm.prank(user1);
        depositContract.depositERC20WithPermit(
            ORDER_ID_1,
            firstDepositAmount,
            deadline,
            address(mockToken),
            v,
            r,
            s
        );

        // Second permit deposit
        (v, r, s) = _getPermitSignature(
            user1,
            address(depositContract),
            secondDepositAmount,
            deadline,
            user1PrivateKey
        );

        vm.prank(user1);
        depositContract.depositERC20WithPermit(
            ORDER_ID_1,
            secondDepositAmount,
            deadline,
            address(mockToken),
            v,
            r,
            s
        );

        uint256 balanceAfter = mockToken.balanceOf(address(depositContract));
        assertEq(
            balanceAfter - balanceBefore,
            firstDepositAmount + secondDepositAmount,
            "Total deposit amount should match"
        );
    }
}
