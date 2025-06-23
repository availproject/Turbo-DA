// SPDX-License-Identifier: UNLICENCSED
pragma solidity 0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {AccessControlDefaultAdminRulesUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardTransientUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardTransientUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TurboDAResolver
 * @author Rachit Anand Srivastava ( @privacy_prophet )
 * @dev A contract for handling deposits and withdrawals of ETH and ERC20 tokens with signature-based authorization
 * @notice This contract allows users to deposit ETH and ERC20 tokens and withdraw them using signed messages
 */
contract TurboDAResolver is
    Initializable,
    AccessControlDefaultAdminRulesUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardTransientUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Role for operators
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Address where admin withdrawals are sent
    address public withdrawalAddress;

    /// @notice Mapping to track which token addresses are valid for deposits
    mapping(address => bool) public validTokenAddresses;

    /**
     * @dev Emitted when a deposit is made
     * @param orderId The unique identifier of the order
     * @param tokenAddress The address of the token (address(0) for ETH)
     * @param amount The amount deposited
     * @param from The address that made the deposit
     */
    event Deposit(
        bytes32 indexed orderId,
        address indexed tokenAddress,
        uint256 amount,
        address from
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
        address indexed tokenAddress,
        address to
    );

    /**
     * @dev Emitted when the withdrawal address is updated
     * @param withdrawalAddress The new withdrawal address
     */
    event WithdrawalAddressUpdate(address withdrawalAddress);

    /// @notice Custom errors for gas-efficient error handling
    error InvalidAmount();
    error InvalidTokenAddress();
    error InvalidSignature();
    error InsufficientDeposit();
    error ETHTransferFailed();
    error NonceAlreadyUsed();

    /**
     * @dev Initializes the contract
     * @notice Sets initial values for withdrawalAddress, owner, and signer
     */
    function initialize(address _owner, uint48 _delay) external initializer {
        __AccessControlDefaultAdminRules_init(_delay, _owner);
        __Pausable_init();
        __ReentrancyGuardTransient_init();
        withdrawalAddress = _owner;
    }

    /**
     * @dev Allows users to deposit ETH
     * @param orderId The unique identifier of the order
     */
    function deposit(bytes32 orderId) external payable whenNotPaused {
        emit Deposit(orderId, address(0), msg.value, msg.sender);
    }

    /**
     * @dev Allows users to deposit ERC20 tokens
     * @param orderId The unique identifier of the order
     * @param amount The amount of tokens to deposit
     * @param tokenAddress The address of the ERC20 token
     */
    function depositERC20(
        bytes32 orderId,
        uint256 amount,
        address tokenAddress
    ) external whenNotPaused nonReentrant {
        _depositERC20(orderId, amount, tokenAddress);
    }

    /**
     * @dev Allows users to deposit ERC20 tokens using EIP-2612 permit
     * @param orderId The unique identifier of the order
     * @param amount The amount of tokens to deposit
     * @param deadline The deadline for the permit signature
     * @param tokenAddress The address of the ERC20 token
     * @param r The r value of the permit signature
     * @param s The s value of the permit signature
     * @param v The v value of the permit signature
     */
    function depositERC20WithPermit(
        bytes32 orderId,
        uint256 amount,
        uint256 deadline,
        address tokenAddress,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant {
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
        _depositERC20(orderId, amount, tokenAddress);
    }

    /**
     * @dev Allows owner to withdraw ETH from the contract
     * @param amount The amount to withdraw (0 for entire balance)
     */
    function withdrawDeposit(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        if (amount == 0) {
            amount = address(this).balance;
        }

        (bool sent, ) = withdrawalAddress.call{value: amount}("");
        if (!sent) revert ETHTransferFailed();
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
    ) external onlyRole(OPERATOR_ROLE) {
        if (!validTokenAddresses[tokenAddress]) {
            revert InvalidTokenAddress();
        }

        if (amount == 0) {
            amount = IERC20(tokenAddress).balanceOf(address(this));
        }

        emit OperatorWithdrawal(
            msg.sender,
            amount,
            tokenAddress,
            withdrawalAddress
        );
        IERC20(tokenAddress).safeTransfer(withdrawalAddress, amount);
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

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Internal function to handle ERC20 deposits
     * @param orderId The unique identifier of the order
     * @param amount The amount to deposit
     * @param tokenAddress The address of the token to deposit
     */
    function _depositERC20(
        bytes32 orderId,
        uint256 amount,
        address tokenAddress
    ) private {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (!validTokenAddresses[tokenAddress]) {
            revert InvalidTokenAddress();
        }

        emit Deposit(orderId, tokenAddress, amount, msg.sender);
        IERC20(tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
    }

    /**
     * @dev Sets whether a token is valid for deposits
     * @param tokenAddress The address of the token
     * @param validity True if the token should be valid, false otherwise
     */
    function configureTokenValidity(
        address tokenAddress,
        bool validity
    ) external onlyRole(OPERATOR_ROLE) {
        validTokenAddresses[tokenAddress] = validity;
    }
}
