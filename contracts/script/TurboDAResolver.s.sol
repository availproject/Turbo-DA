// SPDX-License-Identifier: UNLICENCSED
pragma solidity ^0.8.16;

import {Script, console} from "forge-std/Script.sol";
import {TurboDAResolver} from "../src/TurboDAResolver.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract DeployTurboDAResolverContract is Script {
    function run() external {
        vm.startBroadcast();

        address proxy = Upgrades.deployTransparentProxy(
            "TurboDAResolver.sol",
            msg.sender,
            abi.encodeCall(TurboDAResolver.initialize, (msg.sender, 3 days))
        );

        console.log("TurboDAResolver deployed at:", address(proxy));

        vm.stopBroadcast();
    }
}
