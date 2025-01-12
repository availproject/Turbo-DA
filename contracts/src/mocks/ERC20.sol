// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20, ERC20Permit {
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        uint256 initialSupply
    ) ERC20(name, symbol) ERC20Permit(name) {
        _mint(owner, initialSupply);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
