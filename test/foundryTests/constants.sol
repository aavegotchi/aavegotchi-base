// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.1;

import {Test} from "forge-std/Test.sol";

abstract contract Constants is Test {
    //BASE MAINNET
    // BASE MAINNET addresses (Base chainId 8453)
    address constant BASE_GHST = 0xcD2F22236DD9Dfe2356D7C543161D4d260FD9BcB;
    address constant BASE_VRF_SYSTEM = 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1;
    address constant BASE_SAFE_PROXY_FACTORY = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2;
    // @to-do: update aavegotchiDaoAddress for base mainnet
    address constant BASE_AAVEGOTCHI_DAO_ADDRESS = 0x01F010a5e001fe9d6940758EA5e8c777885E351e;
    address constant BASE_RELAYER_PETTER = 0xf52398257A254D541F392667600901f710a006eD;
    address constant BASE_AAVEGOTCHI_DIAMOND = 0xA99c4B08201F2913Db8D28e71d020c4298F29dBF;
    address constant BASE_FORGE_DIAMOND = 0x50aF2d63b839aA32b4166FD1Cb247129b715186C;
    address constant BASE_WEARABLE_DIAMOND = 0x052e6c114a166B0e91C2340370d72D4C33752B4b;
    address constant BASE_DAO = 0x939b67F6F6BE63E09B0258621c5A24eecB92631c;
    address constant BASE_DAO_TREASURY = 0x939b67F6F6BE63E09B0258621c5A24eecB92631c;
    address constant BASE_RARITY_FARMING = 0x8c8E076Cd7D2A17Ba2a5e5AF7036c2b2B7F790f6;
    address constant BASE_PIXELCRAFT = 0x50Def14C51123660f8768b511B93cC8c09f30356;
    address constant BASE_DAO_DIRECTOR_TREASURY = 0x939b67F6F6BE63E09B0258621c5A24eecB92631c;
    address constant BASE_FAKE_GOTCHI_CARD_DIAMOND = 0xe46B8902dAD841476d9Fee081F1d62aE317206A9;
    address constant BASE_FAKE_GOTCHI_ART_DIAMOND = 0xAb59CA4A16925b0a4BaC5026C94bEB20A29Df479;
    address constant BASE_GG_SKINS_DIAMOND = 0x898d0F54d8CF60698972a75be7Ea1B45aAb66e59;
    address constant BASE_FUD = 0x2028b4043e6722Ea164946c82fe806c4a43a0fF4;
    address constant BASE_FOMO = 0xA32137bfb57d2b6A9Fd2956Ba4B54741a6D54b58;
    address constant BASE_ALPHA = 0x15e7CaC885e3730ce6389447BC0f7AC032f31947;
    address constant BASE_KEK = 0xE52b9170fF4ece4C35E796Ffd74B57Dec68Ca0e5;
    address constant BASE_GLTR = 0x4D140CE792bEdc430498c2d219AfBC33e2992c9D;
    address constant BASE_REALM_DIAMOND = 0x4B0040c3646D3c44B8a28Ad7055cfCF536c05372;
    address constant BASE_INSTALLATION_DIAMOND = 0xebba5b725A2889f7f089a6cAE0246A32cad4E26b;
    address constant BASE_TILE_DIAMOND = 0x617fdB8093b309e4699107F48812b407A7c37938;

    struct Contracts {
        address aavegotchiDiamond;
        address wearableDiamond;
        address forgeDiamond;
        address realmDimond;
        address installationDiamond;
        address tileDiamond;
        address fud;
    }
    mapping(uint256 => Contracts) public contracts;

    constructor() {
        contracts[8453] = Contracts({
            aavegotchiDiamond: BASE_AAVEGOTCHI_DIAMOND,
            wearableDiamond: BASE_WEARABLE_DIAMOND,
            forgeDiamond: BASE_FORGE_DIAMOND,
            realmDimond: BASE_REALM_DIAMOND,
            installationDiamond: BASE_INSTALLATION_DIAMOND,
            tileDiamond: BASE_TILE_DIAMOND,
            fud: BASE_FUD
        });
    }

    function contractByChainId(uint256 chainId) public view returns (Contracts memory) {
        return contracts[chainId];
    }

    function baseMainnetRpcUrl() public view returns (string memory) {
        return vm.envString("BASE_RPC_URL");
    }
}
