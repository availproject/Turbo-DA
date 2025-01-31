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

    bytes public constant USER_ID_1 = "USER1";
    bytes public constant USER_ID_2 = "USER2";

    function _getPermitSignature(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = mockToken.DOMAIN_SEPARATOR();

        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);
        return abi.encodePacked(r, s, v);
    }

    function setUp() public {
        (user1, user1PrivateKey) = makeAddrAndKey("user1");
        (user2, user2PrivateKey) = makeAddrAndKey("user2");

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);

        depositContract = new TurboDAResolver();
        depositContract.initialize(user1);

        mockToken = new MockERC20(
            "MockToken",
            "MTK",
            address(this),
            1000000 ether
        );
        vm.startPrank(user1);
        depositContract.addOperator(user1);
        depositContract.configureTokenValidity(address(mockToken), true);
        vm.stopPrank();
    }

    function testSuccessfulEthDeposit() public {
        uint256 depositAmount = 1 ether;

        vm.prank(user1);
        depositContract.deposit{value: depositAmount}(USER_ID_1);

        uint256 userDeposit = depositContract.userDeposits(
            USER_ID_1,
            address(0),
            user1
        );
        assertEq(userDeposit, depositAmount, "Deposit amount should match");
    }

    function testRevertOnZeroEthDeposit() public {
        vm.prank(user1);
        vm.expectRevert(TurboDAResolver.InvalidAmount.selector);
        depositContract.deposit{value: 0}(USER_ID_1);
    }

    function testSuccessfulERC20Deposit() public {
        uint256 depositAmount = 100 ether;

        mockToken.mint(user1, depositAmount);

        vm.prank(user1);
        mockToken.approve(address(depositContract), depositAmount);

        vm.prank(user1);
        depositContract.depositERC20(
            USER_ID_1,
            depositAmount,
            address(mockToken)
        );

        uint256 userDeposit = depositContract.userDeposits(
            USER_ID_1,
            address(mockToken),
            user1
        );
        assertEq(userDeposit, depositAmount, "Deposit amount should match");
    }

    function testRevertOnZeroERC20Deposit() public {
        vm.prank(user1);
        vm.expectRevert(TurboDAResolver.InvalidAmount.selector);
        depositContract.depositERC20(USER_ID_1, 0, address(mockToken));
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
            USER_ID_1,
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
            USER_ID_1,
            depositAmount,
            address(mockToken)
        );
    }

    function testMultipleDepositsForSameUser() public {
        uint256 firstDepositAmount = 50 ether;
        uint256 secondDepositAmount = 75 ether;

        mockToken.mint(user1, firstDepositAmount + secondDepositAmount);

        vm.startPrank(user1);
        mockToken.approve(
            address(depositContract),
            firstDepositAmount + secondDepositAmount
        );

        depositContract.depositERC20(
            USER_ID_1,
            firstDepositAmount,
            address(mockToken)
        );

        depositContract.depositERC20(
            USER_ID_1,
            secondDepositAmount,
            address(mockToken)
        );
        vm.stopPrank();

        uint256 userDeposit = depositContract.userDeposits(
            USER_ID_1,
            address(mockToken),
            user1
        );
        assertEq(
            userDeposit,
            firstDepositAmount + secondDepositAmount,
            "Total deposit should accumulate"
        );
    }

    // Test successful permit deposit
    function testSuccessfulPermitDeposit() public {
        uint256 depositAmount = 100 ether;
        uint256 deadline = block.timestamp + 1 days;

        mockToken.mint(user1, depositAmount);

        // Generate permit signature
        bytes memory signature = _getPermitSignature(
            user1,
            address(depositContract),
            depositAmount,
            deadline,
            user1PrivateKey
        );

        // Perform permit deposit
        vm.prank(user1);
        depositContract.depositERC20WithPermit(
            USER_ID_1,
            depositAmount,
            deadline,
            address(mockToken),
            signature
        );

        // Check deposit was recorded correctly
        uint256 userDeposit = depositContract.userDeposits(
            USER_ID_1,
            address(mockToken),
            user1
        );
        assertEq(userDeposit, depositAmount, "Deposit amount should match");
    }

    // Test permit deposit with invalid signature length
    function testRevertOnInvalidSignatureLength() public {
        uint256 depositAmount = 100 ether;
        uint256 deadline = block.timestamp + 1 days;

        // Create an invalid signature with incorrect length
        bytes memory invalidSignature = new bytes(64);

        vm.prank(user1);
        vm.expectRevert(TurboDAResolver.InvalidSignature.selector);
        depositContract.depositERC20WithPermit(
            USER_ID_1,
            depositAmount,
            deadline,
            address(mockToken),
            invalidSignature
        );
    }

    // Test multiple permit deposits
    function testMultiplePermitDeposits() public {
        uint256 firstDepositAmount = 50 ether;
        uint256 secondDepositAmount = 75 ether;
        uint256 deadline = block.timestamp + 1 days;

        mockToken.mint(user1, 1000000 ether);

        // First permit deposit
        bytes memory firstSignature = _getPermitSignature(
            user1,
            address(depositContract),
            firstDepositAmount,
            deadline,
            user1PrivateKey
        );

        vm.prank(user1);
        depositContract.depositERC20WithPermit(
            USER_ID_1,
            firstDepositAmount,
            deadline,
            address(mockToken),
            firstSignature
        );

        // Second permit deposit
        bytes memory secondSignature = _getPermitSignature(
            user1,
            address(depositContract),
            secondDepositAmount,
            deadline,
            user1PrivateKey
        );

        vm.prank(user1);
        depositContract.depositERC20WithPermit(
            USER_ID_1,
            secondDepositAmount,
            deadline,
            address(mockToken),
            secondSignature
        );

        // Check total deposit
        uint256 userDeposit = depositContract.userDeposits(
            USER_ID_1,
            address(mockToken),
            user1
        );
        assertEq(
            userDeposit,
            firstDepositAmount + secondDepositAmount,
            "Total deposit should accumulate"
        );
    }
    // Helper function to create signature
    function _createSignature(
        bytes memory userID,
        address tokenAddress,
        uint256 amount,
        address recipient
    ) internal view returns (bytes memory) {
        bytes memory message = abi.encodePacked(
            userID,
            tokenAddress,
            amount,
            recipient,
            nonce
        );

        bytes32 messageHash = keccak256(message);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, messageHash);
        return abi.encodePacked(r, s, v);
    }
}
