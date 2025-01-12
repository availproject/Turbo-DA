// SPDX-License-Identifier: UNLICENCSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Create2} from "../src/Create2.sol";
import {console} from "forge-std/console.sol";
import {TurboDAResolver} from "../src/TurboDAResolver.sol";
import {ERC1967Proxy} from "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract UpgradeabilityTest is Test {
    function test_upgradeability() public {
        bytes32 salt = "turboDA";
        Create2 create2 = new Create2();

        bytes memory creationCode = abi.encodePacked(
            type(TurboDAResolver).creationCode
        );

        address resolver = create2.deploy(salt, creationCode);

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

        TurboDAResolver proxy = TurboDAResolver(deployedAddress);
        assert(proxy.hasRole(proxy.DEFAULT_ADMIN_ROLE(), msg.sender));

        assert(computedAddress == deployedAddress);

        address newImplementation = address(new TurboDAResolver());

        vm.startPrank(msg.sender);
        TurboDAResolver(payable(deployedAddress)).upgradeToAndCall(
            address(newImplementation),
            ""
        );

        vm.stopPrank();
    }
}
