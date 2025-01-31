// SPDX-License-Identifier: UNLICENCSED
pragma solidity 0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "openzeppelin-contracts/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/**
 * @title TurboDAResolver
 * @author Rachit Anand Srivastava ( @privacy_prophet )
 * @dev A contract for handling deposits and withdrawals of ETH and ERC20 tokens with signature-based authorization
 * @notice This contract allows users to deposit ETH and ERC20 tokens and withdraw them using signed messages
 */
contract TurboDAResolver is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    /**
     * @dev Emitted when a deposit is made
     * @param userID The unique identifier of the user
     * @param tokenAddress The address of the token (address(0) for ETH)
     * @param amount The amount deposited
     * @param from The address that made the deposit
     */
    event Deposit(
        bytes userID,
        address tokenAddress,
        uint256 amount,
        address from
    );
    /**
     * @dev Emitted when a Withdrawal is made
     * @param userID The unique identifier of the user
     * @param tokenAddress The address of the token (address(0) for ETH)
     * @param amount The amount withdrawn
     * @param to The address that made the withdrawal
     */
    event Withdrawal(
        bytes userID,
        address tokenAddress,
        uint256 amount,
        address to
    );

    /**
     * @dev Emitted when an operator withdraws funds from the contract
     * @param operator The address of the operator performing the withdrawal
     * @param amount The amount being withdrawn
     * @param tokenAddress The address of the token being withdrawn (address(0) for ETH)
     * @param to The address receiving the withdrawn funds
     */
    event OperatorWithdrawal(
        address operator,
        uint256 amount,
        address tokenAddress,
        address to
    );

    /**
     * @dev Emitted when the withdrawal address is updated
     * @param withdrawalAddress The new withdrawal address
     */
    event WithdrawalAddressUpdate(address withdrawalAddress);

    // Custom errors for gas-efficient error handling
    error InvalidAmount();
    error InvalidTokenAddress();
    error InvalidSignature();
    error InsufficientDeposit();
    error FailedToSendEther();
    error NonceAlreadyUsed();

    /// @notice Role for operators
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Mapping to track which token addresses are valid for deposits
    mapping(address => bool) public validTokenAddresses;

    /// @notice Nested mapping tracking deposits: userID => tokenAddress => depositor => amount
    mapping(bytes => mapping(address => mapping(address => uint256)))
        public userDeposits;

    /// @notice Address where admin withdrawals are sent
    address public withdrawalAddress;
    mapping(uint256 => bool) public usedNonce;

    /**
     * @dev Initializes the contract
     * @notice Sets initial values for withdrawalAddress, owner, and signer
     */
    function initialize(address _owner) public initializer {
        withdrawalAddress = _owner;
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        _setRoleAdmin(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    /**
     * @dev Allows users to deposit ETH
     * @param userID The unique identifier of the user
     */
    function deposit(
        bytes calldata userID
    ) public payable whenNotPaused nonReentrant {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        userDeposits[userID][address(0)][msg.sender] += msg.value;
        emit Deposit(userID, address(0), msg.value, msg.sender);
    }

    /**
     * @dev Allows users to deposit ERC20 tokens
     * @param userID The unique identifier of the user
     * @param amount The amount of tokens to deposit
     * @param tokenAddress The address of the ERC20 token
     */
    function depositERC20(
        bytes calldata userID,
        uint256 amount,
        address tokenAddress
    ) public whenNotPaused nonReentrant {
        _depositERC20(userID, amount, tokenAddress);
    }

    /**
     * @dev Allows users to deposit ERC20 tokens using EIP-2612 permit
     * @param userID The unique identifier of the user
     * @param amount The amount of tokens to deposit
     * @param deadline The deadline for the permit signature
     * @param tokenAddress The address of the ERC20 token
     * @param signature The permit signature
     */
    function depositERC20WithPermit(
        bytes calldata userID,
        uint256 amount,
        uint256 deadline,
        address tokenAddress,
        bytes memory signature
    ) public whenNotPaused nonReentrant {
        if (signature.length != 65) {
            revert InvalidSignature();
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly ("memory-safe") {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        /// @dev Try to call permit, if it fails, don't revert and continue. https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#IERC20Permit
        try
            IERC20Permit(tokenAddress).permit(
                msg.sender,
                address(this),
                amount,
                deadline,
                v,
                r,
                s
            )
        {} catch {}
        _depositERC20(userID, amount, tokenAddress);
    }

    /**
     * @dev Allows owner to withdraw ETH from the contract
     * @param amount The amount to withdraw (0 for entire balance)
     */
    function withdrawDeposit(uint256 amount) public onlyRole(OPERATOR_ROLE) {
        if (amount == 0) {
            amount = address(this).balance;
        }

        if (amount > address(this).balance) {
            revert InvalidAmount();
        }

        (bool sent, ) = withdrawalAddress.call{value: amount}("");
        if (!sent) revert FailedToSendEther();
        emit OperatorWithdrawal(
            msg.sender,
            amount,
            address(0),
            withdrawalAddress
        );
    }

    /**
     * @dev Allows owner to withdraw ERC20 tokens from the contract
     * @param amount The amount to withdraw (0 for entire balance)
     * @param tokenAddress The address of the token to withdraw
     */
    function withdrawDepositERC20(
        uint256 amount,
        address tokenAddress
    ) public onlyRole(OPERATOR_ROLE) {
        if (!validTokenAddresses[tokenAddress]) {
            revert InvalidTokenAddress();
        }

        if (amount > IERC20(tokenAddress).balanceOf(address(this))) {
            revert InvalidAmount();
        }

        if (amount == 0) {
            amount = IERC20(tokenAddress).balanceOf(address(this));
        }

        IERC20(tokenAddress).transfer(withdrawalAddress, amount);
        emit OperatorWithdrawal(
            msg.sender,
            amount,
            tokenAddress,
            withdrawalAddress
        );
    }

    /**
     * @dev Internal function to handle ERC20 deposits
     * @param userID The unique identifier of the user
     * @param amount The amount to deposit
     * @param tokenAddress The address of the token to deposit
     */
    function _depositERC20(
        bytes calldata userID,
        uint256 amount,
        address tokenAddress
    ) internal {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (!validTokenAddresses[tokenAddress]) {
            revert InvalidTokenAddress();
        }
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);

        userDeposits[userID][tokenAddress][msg.sender] += amount;
        emit Deposit(userID, tokenAddress, amount, msg.sender);
    }

    /**
     * @dev Updates the withdrawal address
     * @param _newWithdrawalAddress The new address for withdrawals
     */
    function updateWithdrawalAddress(
        address _newWithdrawalAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        withdrawalAddress = _newWithdrawalAddress;
        emit WithdrawalAddressUpdate(withdrawalAddress);
    }

    /**
     * @dev Adds an operator address with OPERATOR_ROLE permissions
     * @param _operator The address to grant operator role to
     * @notice Only callable by accounts with DEFAULT_ADMIN_ROLE. Function grantRole enforces this condition
     */

    function addOperator(address _operator) external {
        grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @dev Removes an operator address by revoking their OPERATOR_ROLE permissions
     * @param _operator The address to revoke operator role from
     * @notice Only callable by accounts with DEFAULT_ADMIN_ROLE. Function revokeRole enforces this condition
     */

    function removeOperator(address _operator) external {
        revokeRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @dev Sets whether a token is valid for deposits
     * @param tokenAddress The address of the token
     * @param validity True if the token should be valid, false otherwise
     */
    function configureTokenValidity(
        address tokenAddress,
        bool validity
    ) public onlyRole(OPERATOR_ROLE) {
        validTokenAddresses[tokenAddress] = validity;
    }
    /**
     * @dev Authorizes an upgrade to a new implementation
     * @param newImplementation The address of the new implementation
     * @notice Only callable by accounts with DEFAULT_ADMIN_ROLE
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
