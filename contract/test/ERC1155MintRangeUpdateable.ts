import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import _getUpdateInitialHolderRangesInputSafe, { _getUpdateInitialHolderRangesInput } from "../scripts/_getUpdateInitialHolderRangesInput";
import { testERC1155MintRange } from "./ERC1155MintRange";
import { testERC1155MintRangePausable } from "./ERC1155MintRangePausable";
import { TestERC1155MintRangeUpdateable, Ph101ppDailyPhoto, ERC1155MintRangeUpdateable } from "../typechain-types";
import { deployFixture, Fixture } from "./fixture";
import verified from "./verified";
import integrityCheck from "./integrityCheck";


async function fixture<T>() {
  // Contracts are deplodyed using the first signer/account by default
  const [owner, account1, account2, account3, account4, account5, account6, account7, account8] = await ethers.getSigners();

  const DT = await ethers.getContractFactory("Ph101ppDailyPhotoUtils");
  const dt = await DT.deploy();
  const C = await ethers.getContractFactory("TestERC1155MintRangeUpdateable", {
    libraries: {
      "Ph101ppDailyPhotoUtils": dt.address, // test: "0x947cc35992e6723de50bf704828a01fd2d5d6641" //dt.address
    }
  })
  const c = await C.deploy([]) as T;

  return { c, owner, account1, account2, account3, account4, account5, account6, account7, account8 };
}

describe("TestERC1155MintRangeUpdateable", function () {
  testERC1155MintRange(fixture);
  testERC1155MintRangePausable(fixture);
  testERC1155MintRangeUpdateable(fixture);
});

export function testERC1155MintRangeUpdateable(deployFixture: () => Promise<Fixture<TestERC1155MintRangeUpdateable>>) {

  describe.skip("verifyUpdateInitialHolderRangesInput", function () {

    it("should return a hash when successfull", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);

      await c.setInitialHolders([account1.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await c.verifyUpdateInitialHolderRangesInput(1, 1,
        {
          fromAddresses: [account1.address],
          toAddresses: [account2.address],
          ids: [[1]],
          amounts: [[1]],
          initialize: [[]],
          newInitialHolders: [[account2.address]],
          newInitialHoldersRange: [0]
        });
    })

    it("should fail when contract is not paused", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[1]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("Pausable: not paused");
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[1]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejectedWith("Pausable: not paused");
    })

    it("should fail when to address is not part of new initial holders", async function () {
      const { c, account1, account2, account3 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account1.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:10");
    });

    it("should fail when number of initial holders dont match range", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;

      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account1.address], [account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:04");

      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account1.address]],
        newInitialHoldersRange: [0, 1]
      })).to.be.rejectedWith("E:04");
    });

    it("should fail when range does not start at 0 or isnt consecutive", async function () {
      const { c, account1, account2, account3 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [1]
      })).to.be.rejectedWith("E:05");
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account1.address], [account2.address], [account3.address]],
        newInitialHoldersRange: [0, 3, 2]
      })).to.be.rejectedWith("E:06");
    });

    it("should fail number of amounts, ids, to and from dont match", async function () {
      const { c, account1, account2, account3 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1], [1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:03");
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0], [0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:02");
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address, account3.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:01");
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address, account3.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:01");
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0, 1]],
        amounts: [[1]],
        initialize: [[account2.address]],
        newInitialHolders: [[]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:07");
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1, 1]],
        initialize: [[account2.address]],
        newInitialHolders: [[]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:07");
    });

    it("should fail when from account balance is less than amount", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[2]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account2.address],
        toAddresses: [account1.address],
        ids: [[0]],
        amounts: [[2]],
        initialize: [[]],
        newInitialHolders: [[account1.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:13");
      await expect(c.verifyUpdateInitialHolderRangesInput(1, 1, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[1]],
        amounts: [[3]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:08");
    });

    it("should fail when id does not exist", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(1, 1, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[1]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;
      await expect(c.verifyUpdateInitialHolderRangesInput(3, 3, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[3]],
        amounts: [[2]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:11");
    });

    it("should fail when token balance for from/to addresses is initialized", async function () {
      const { c, account1, account2, account3 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address, account2.address]);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await verified.connect(account1).safeTransferFrom(c, account1.address, account3.address, 1, 1, []);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(1, 1, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[1]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:13");
    });

    it("should fail when token was minted manually", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      await verified.mint(c, account1.address, 1, 1, []);
      const input = await c.getMintRangeInput(3);
      await verified.mintRange(c, input[0]);
      await c.pause();
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[0]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.not.be.rejected;
      await expect(c.verifyUpdateInitialHolderRangesInput(0, 0, {
        fromAddresses: [account1.address],
        toAddresses: [account2.address],
        ids: [[1]],
        amounts: [[1]],
        initialize: [[]],
        newInitialHolders: [[account2.address]],
        newInitialHoldersRange: [0]
      })).to.be.rejectedWith("E:12");
    });

  });

  describe("updateInitialHolderRangesInput / _getUpdateInitialHolderRangesInputSafe / verifyUpdateInitialHolderRangesInput", function () {

    it("should fail when getting bad input or not paused", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address, account2.address]);

      await expect(_getUpdateInitialHolderRangesInputSafe(c, [[account1.address, account2.address]])).to.be.rejectedWith("Pausable: not paused");
      await c.pause();
      await _getUpdateInitialHolderRangesInputSafe(c, [[account1.address, account2.address]])
        .catch((e) => { expect(true).to.equal(false) });
      await _getUpdateInitialHolderRangesInputSafe(c, [[account1.address]])
        .then(() => { expect(true).to.equal(false) })
        .catch((e) => { expect(e.message).to.equal("Error: newInitialHolders.length does not match") });
      await _getUpdateInitialHolderRangesInputSafe(c, [[account1.address, account2.address], [account1.address, account2.address]])
        .then(() => { expect(true).to.equal(false) })
        .catch((e) => { expect(e.message).to.equal("Error: newInitialHolders.length does not match") });
    })

    it("should skip manuallyMinted tokens && reinitialize initializedBalances", async function () {
      const { c, account1, account2, account3, account4, } = await loadFixture(deployFixture);
      const initialHolders = [account1.address];
      await c.setInitialHolders(initialHolders);
      await verified.mintBatch(c, account2.address, [0, 1], [10, 10], []);
      const mintIntput = await c.getMintRangeInput(5);
      await verified.mintRange(c, mintIntput[0]);
      // console.log(await c.balanceOf(account1.address, 5))
      await verified.connect(account1).safeTransferFrom(c, account1.address, account3.address, 5, 3, []);
      await c.pause();

      const [{ fromAddresses, toAddresses, ids, amounts, initialize, ...rest }, checksum] = await _getUpdateInitialHolderRangesInputSafe(c, [[account4.address]]);
      expect(fromAddresses.length).to.equal(1);
      expect(toAddresses.length).to.equal(1);
      expect(ids.length).to.equal(1);
      expect(amounts.length).to.equal(1);

      expect(ids[0]).to.not.include(0);
      expect(ids[0]).to.not.include(1);
      expect(ids[0]).to.not.include(5);

      expect(initialize[0]).to.not.include(0);
      expect(initialize[0]).to.not.include(1);
      expect(initialize[0]).to.include(5);

      const integrity = await integrityCheck(c).ids([account1.address, account2.address, account3.address, account4.address], [0,1,5]);
      const balancesCheck =  await integrity.balances();
      const supplyCheck =  await integrity.supplies();

      await verified.updateInitialHolderRanges(c, { fromAddresses, toAddresses, ids, amounts, initialize, ...rest });

      await balancesCheck.expectEqual()
      await supplyCheck.expectEqual()

      expect(await c.balanceOf(account4.address, 5)).to.equal(0);
      expect(await c.balanceOf(account3.address, 5)).to.equal(3);
      expect(await c.balanceOf(account1.address, 5)).to.equal(3);

    });

    it("should correcly update initialHolders of a simple range", async function () {
      const { c, account1, account2, account3, account4, } = await loadFixture(deployFixture);
      const initialHolders = [account1.address, account2.address];
      await c.setInitialHolders(initialHolders);
      const mintIntput = await c.getMintRangeInput(5);
      const ids = mintIntput[0][0];
      await verified.mintRange(c, mintIntput[0]);
      await c.pause();
      const newInitialHolders = [account1.address, account3.address];
      const [rangeInput] = await _getUpdateInitialHolderRangesInputSafe(c, [newInitialHolders]);
      
      const tx = await verified.updateInitialHolderRanges(c, rangeInput);
      
      const receipt = await tx.wait();

      expect(receipt.events?.filter(e => e.event === "Paused").length).to.equal(1);
      expect(receipt.events?.filter(e => e.event === "Unpaused").length).to.equal(1);

      expect(receipt.events?.filter(e => e.event === "TransferBatch").length).to.equal(rangeInput.ids.length);

      const balancesAccount1 = await c.balanceOfBatch(ids.map(() => account1.address), ids);
      const balancesAccount2 = await c.balanceOfBatch(ids.map(() => account2.address), ids);
      const balancesAccount3 = await c.balanceOfBatch(ids.map(() => account3.address), ids);

      for (let i = 0; i < ids.length; i++) {
        if (i === 0) {
          expect(balancesAccount1[i]).to.equal(9999);
          expect(balancesAccount2[i]).to.equal(0);
          expect(balancesAccount3[i]).to.equal(9999);
        }
        else {
          expect(balancesAccount1[i]).to.equal(i + 1);
          expect(balancesAccount2[i]).to.equal(0);
          expect(balancesAccount3[i]).to.equal(i + 1);
        }
      }
    });

    it("should correcly update initialHolders across multiple ranges", async function () {
      const { c, account1, account2, account3, account4, } = await loadFixture(deployFixture);
      await c.setInitialHolders([account1.address]);
      const mintIntput = await c.getMintRangeInput(2);
      await verified.mintRange(c, mintIntput[0]);
      await c.setInitialHolders([account2.address]);
      const mintIntput2 = await c.getMintRangeInput(2);
      await verified.mintRange(c, mintIntput2[0]);
      await c.setInitialHolders([account3.address]);
      const mintIntput3 = await c.getMintRangeInput(2);
      await verified.mintRange(c, mintIntput3[0]);
      await c.pause();

      const [rangeInput] = await _getUpdateInitialHolderRangesInputSafe(c, [[account1.address], [account4.address], [account4.address] ]);
      const tx = await verified.updateInitialHolderRanges(c, rangeInput);
      const receipt = await tx.wait();

      const empty = new Array(6).fill(0);

      const fromAddresses = rangeInput.fromAddresses;
      expect(receipt.events?.filter(e => e.event === "TransferBatch").length).to.equal(fromAddresses.length);

      const balancesAccount1 = await c.balanceOfBatch(empty.fill(account1.address), empty.map((x, i) => i));
      const balancesAccount2 = await c.balanceOfBatch(empty.fill(account2.address), empty.map((x, i) => i));
      const balancesAccount3 = await c.balanceOfBatch(empty.fill(account3.address), empty.map((x, i) => i));
      const balancesAccount4 = await c.balanceOfBatch(empty.fill(account4.address), empty.map((x, i) => i));

      for (let i = 0; i < 6; i++) {
        if (i === 0) {
          expect(balancesAccount1[i]).to.equal(9999);
          expect(balancesAccount2[i]).to.equal(0);
          expect(balancesAccount3[i]).to.equal(0);
          expect(balancesAccount4[i]).to.equal(0);
        }
        else if (i < 2) {
          expect(balancesAccount1[i]).to.equal(i + 1);
          expect(balancesAccount2[i]).to.equal(0);
          expect(balancesAccount3[i]).to.equal(0);
          expect(balancesAccount4[i]).to.equal(0);
        }
        else {
          expect(balancesAccount1[i]).to.equal(0);
          expect(balancesAccount2[i]).to.equal(0);
          expect(balancesAccount3[i]).to.equal(0);
          expect(balancesAccount4[i]).to.equal(i + 1);
        }
      }
    });

    it("should fail to create update initialHolders input when new holder is address(0)", async function () {
      const { c, account1, account2, account3, account4, } = await loadFixture(deployFixture);
      const initialHolders = [account1.address, account2.address];
      const initialHolders2 = [account3.address, account4.address];
      await c.setInitialHolders(initialHolders);
      const mintIntput = await c.getMintRangeInput(5);
      await verified.mintRange(c, mintIntput[0]);
      await c.pause();
      const newInitialHolders = [ethers.constants.AddressZero, account3.address];
      const newInitialHolders2 = [account1.address, ethers.constants.AddressZero];
      await expect(_getUpdateInitialHolderRangesInputSafe(c, [newInitialHolders])).to.be.rejectedWith("E:16");
      await expect(_getUpdateInitialHolderRangesInputSafe(c, [newInitialHolders2])).to.be.rejectedWith("E:16");
    });
  });

  describe("updateInitialHolderRanges non-safe", function (){

    async function setupRandomContractState({ c, owner, account1, account2, account3, account4 }: Fixture<TestERC1155MintRangeUpdateable>){
      const moreSigners = (await ethers.getSigners()).slice(9);
      const randomMintIds= [...new Set(new Array(30).fill(null).map(()=>Math.round(Math.random()*200)))]; 

      await verified.mintBatch(c, moreSigners[0].address, randomMintIds, new Array(randomMintIds.length).fill(10), []);

      await randomMintIds.forEach(async (id)=>{
        await verified.connect(moreSigners[0]).safeTransferFrom(c, moreSigners[0].address, moreSigners[Math.floor(Math.random()*moreSigners.length)].address, id, 2, []);
        await verified.connect(moreSigners[0]).safeTransferFrom(c, moreSigners[0].address, moreSigners[Math.floor(Math.random()*moreSigners.length)].address, id, 2, []);
        await verified.connect(moreSigners[0]).safeTransferFrom(c, moreSigners[0].address, moreSigners[Math.floor(Math.random()*moreSigners.length)].address, id, 2, [])
      }); 

      const initialHolders1 = [account1.address, account2.address];
      await c.setInitialHolders(initialHolders1);
      const inputs = await c.getMintRangeInput(100);
      await verified.mintRangeSafe(c, ...inputs);

      const initialHolders2 = [account3.address, account4.address];
      await c.setInitialHolders(initialHolders2);
      const inputs2 = await c.getMintRangeInput(100);
      await verified.mintRangeSafe(c, ...inputs2);


      const randomTransferIds= [...new Set(new Array(30).fill(null).map(()=>Math.round(Math.random()*200)))]; 

      await randomTransferIds.forEach(async (id)=>{
        const owner = randomMintIds.includes(id) ? moreSigners[0] : id>100? account1 : account3;
        await verified.connect(owner).safeTransferFrom(c, owner.address, moreSigners[Math.floor(Math.random()*moreSigners.length)].address, id, 1, []);
      });


      return await integrityCheck(c).range(moreSigners.map((s)=>s.address), 0, 200);
    }

    it("should not affect any minted / transferred tokens when updating initialHolders", async function () {
      const fixture = await loadFixture(deployFixture);
      const { c, account5, account6, account7, account8 } = fixture;

      const input = await _getUpdateInitialHolderRangesInput(c, [[account5.address, account6.address], [account5.address, account6.address]]);

      const integrity = await setupRandomContractState(fixture);
      const supplyCheck = await integrity.supplies()
      const balancesCheck = await integrity.balances()

      // console.log(await c.initialHolderRanges());
      await c.pause();
      const tx = await verified.updateInitialHolderRanges(c, input);

      await supplyCheck.expectEqual();
      await balancesCheck.expectEqual()

      // await c.setInitialHolders([account1.address, account2.address]);

      // await expect(_getUpdateInitialHolderRangesInputSafe(c, 1, 300, [account1.address, account2.address])).to.be.rejectedWith("Pausable: not paused");
      // await c.pause();
      // await _getUpdateInitialHolderRangesInputSafe(c, 1, 300, [account1.address, account2.address])
      //   .catch((e) => { expect(true).to.equal(false) });
      // await _getUpdateInitialHolderRangesInputSafe(c, -1, 300, [account1.address, account2.address])
      //   .then(() => { expect(true).to.equal(false) })
      //   .catch((e) => { expect(e.message).to.equal("Error: from < 0 || from > to") });
      // await _getUpdateInitialHolderRangesInputSafe(c, 1, 0, [account1.address, account2.address])
      //   .then(() => { expect(true).to.equal(false) })
      //   .catch((e) => { expect(e.message).to.equal("Error: from < 0 || from > to") });
      // await _getUpdateInitialHolderRangesInputSafe(c, 0, 1, [account1.address])
      //   .then(() => { expect(true).to.equal(false) })
      //   .catch((e) => { expect(e.message).to.equal("Error: newInitialHolders.length does not match") });
    })



  })

  describe("Lock initial holders", function () {
    it("should fail to lock initial holders of unminted tokens or if tokens are already locked", async function () {
      const { c, account1, account2, account3, account4, } = await loadFixture(deployFixture);

      await expect(c.setLockInitialHoldersUpTo(6)).to.be.rejectedWith("Unminted tokens.")

      const initialHolders = [account1.address, account2.address];
      await c.setInitialHolders(initialHolders);
      const mintIntput = await c.getMintRangeInput(5);
      await verified.mintRange(c, mintIntput[0]);

      await expect(c.setLockInitialHoldersUpTo(7)).to.be.rejectedWith("Unminted tokens.")
      await expect(c.setLockInitialHoldersUpTo(4)).to.not.be.rejected;

      await expect(c.setLockInitialHoldersUpTo(4)).to.be.rejectedWith("Already locked.");
    });

    it("should fail to lock initial holders when paused", async function () {
      const { c, account1, account2, account3, account4, } = await loadFixture(deployFixture);
      const initialHolders = [account1.address, account2.address];
      await c.setInitialHolders(initialHolders);
      const mintIntput = await c.getMintRangeInput(5);
      await verified.mintRange(c, mintIntput[0]);
      await c.pause();
      await expect(c.setLockInitialHoldersUpTo(4)).to.be.rejectedWith("Pausable: paused");
    });

    it("should fail to create update initialHolders input of locked range", async function () {
      const { c, account1, account2, account3, account4, account5, account6 } = await loadFixture(deployFixture);
      const initialHolders = [account1.address, account2.address];
      const initialHolders2 = [account3.address, account4.address];
      const initialHolders3 = [account2.address, account1.address];
      await c.setInitialHolders(initialHolders);
      const mintIntput = await c.getMintRangeInput(3);
      await verified.mintRange(c, mintIntput[0]);
      await c.setInitialHolders(initialHolders2);
      const mintIntput2 = await c.getMintRangeInput(2);
      await verified.mintRange(c, mintIntput2[0]);
      await c.setInitialHolders(initialHolders3);
      const mintIntput3 = await c.getMintRangeInput(2);
      await verified.mintRange(c, mintIntput3[0]);
      await c.setLockInitialHoldersUpTo(4);
      await c.pause();
      const newInitialHolders = [account5.address, account6.address];
      await expect(_getUpdateInitialHolderRangesInputSafe(c, [newInitialHolders, initialHolders2, initialHolders3])).to.be.rejectedWith("E:18");
      await expect(_getUpdateInitialHolderRangesInputSafe(c, [initialHolders, newInitialHolders, initialHolders3])).to.be.rejectedWith("E:18");
      await expect(_getUpdateInitialHolderRangesInputSafe(c, [initialHolders, initialHolders2, newInitialHolders])).to.not.be.rejected;
    });

  })
};