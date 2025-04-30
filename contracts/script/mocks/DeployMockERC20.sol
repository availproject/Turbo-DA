// SPDX-License-Identifier: UNLICENCSED
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../../src/mocks/ERC20.sol";

contract DeployMockERC20 is Script {
    function run() external {
        vm.startBroadcast();
        MockERC20 mockERC20 = new MockERC20(
            "MockToken",
            "MTK",
            address(this),
            1000000 ether
        );
        vm.stopBroadcast();
        console.log("MockERC20 deployed at:", address(mockERC20));
    }
}
