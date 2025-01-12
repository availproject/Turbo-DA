// SPDX-License-Identifier: UNLICENCSED
pragma solidity ^0.8.16;

import {Script, console} from "forge-std/Script.sol";
import {TurboDAResolver} from "../src/TurboDAResolver.sol";
import {Create2} from "../src/Create2.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {ERC1967Proxy} from "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployTurboDAResolverContract is Script {
    function run() external {
        vm.startBroadcast();
        bytes32 salt = "turboDA";
        Create2 create2 = new Create2();

        console.log("Create2 deployed at:", address(create2));

        bytes memory creationCode = abi.encodePacked(
            type(TurboDAResolver).creationCode
        );

        address resolver = create2.deploy(salt, creationCode);
        console.log("TurboDAResolver deployed at:", address(resolver));

        creationCode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(
                address(resolver),
                abi.encodeCall(TurboDAResolver.initialize, (msg.sender))
            )
        );

        address computedAddress = create2.computeAddress(
            salt,
            keccak256(creationCode)
        );
        address deployedAddress = create2.deploy(salt, creationCode);

        vm.stopBroadcast();

        console.log(
            "Computed/Deployed Addresses:",
            computedAddress,
            deployedAddress
        );
    }
}
