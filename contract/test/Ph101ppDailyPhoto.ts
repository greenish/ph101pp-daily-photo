import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { BaseContract } from "ethers";
import getPh101ppDailyPhotoUpdateInitialHoldersInput from "../scripts/getPh101ppDailyPhotoUpdateInitialHoldersInput";
import { Ph101ppDailyPhoto, TestOperatorFilterRegistry, TestIPh101ppDailyPhotoListener } from "../typechain-types";
import { Fixture, SignerWithAddress } from "./fixture";
import verified from "./verified";
import integrityCheck from "./integrityCheck";

const SECONDS_PER_DAY = 24 * 60 * 60;
const nowTimestamp = Math.ceil(Date.now() / 1000) + SECONDS_PER_DAY * 3;

type FixturePDP = {
  ofr: TestOperatorFilterRegistry,
  pdpl: TestIPh101ppDailyPhotoListener,
  treasury: SignerWithAddress,
  vault: SignerWithAddress,
  mutableUri: string,
  immutableUri: string,
}
describe("Ph101ppDailyPhoto", function () {
  testPh101ppDailyPhoto(deployFixture());
});

function deployFixture<T extends BaseContract>(): () => Promise<Fixture<T> & FixturePDP> {
  const mutableUri = "mutable_.uri/";
  const immutableUri = "immutable.uri/";

  return async function fixture() {
    // Contracts are deplodyed using the first signer/account by default
    const [owner, treasury, vault, account1, account2, account3, account4, account5, account6, account7, account8] = await ethers.getSigners();
    const latest = await time.latest();

    if (latest < nowTimestamp) {
      await time.increaseTo(nowTimestamp);
    }

    const OperatorFilterRegistry = await ethers.getContractFactory("TestOperatorFilterRegistry")
    const ofr = await OperatorFilterRegistry.attach("0x000000000000AAeB6D7670E522A718067333cd4E")
    // const ofr = await OperatorFilterRegistry.deploy();


    const DT = await ethers.getContractFactory("Ph101ppDailyPhotoUtils");
    const dt = await DT.deploy();
    const PDP = await ethers.getContractFactory("Ph101ppDailyPhoto", {
      libraries: {
        "Ph101ppDailyPhotoUtils": dt.address, // test: "0x947cc35992e6723de50bf704828a01fd2d5d6641" //dt.address
      }
    });

    const c = await PDP.deploy(mutableUri, [treasury.address, vault.address]) as BaseContract as T;
    const pdp: Ph101ppDailyPhoto = c as BaseContract as Ph101ppDailyPhoto;
    await pdp.setPermanentBaseUriUpTo(immutableUri, 0);
    await pdp.mintClaims(treasury.address, 10, []);
    const PDPL = await ethers.getContractFactory("TestIPh101ppDailyPhotoListener");
    const pdpl = await PDPL.deploy(c.address);

    return { c, ofr, pdpl, owner, treasury, vault, mutableUri, immutableUri, account1, account2, account3, account4, account5, account6, account7, account8 };
  }
}


export function testPh101ppDailyPhoto(deployFixture: () => Promise<Fixture<Ph101ppDailyPhoto> & FixturePDP>) {

  describe("Interface", function () {
    it("It should support interfaces ERC1155, ERC2981, ERC165", async function () {
      const { c, mutableUri, immutableUri } = await loadFixture(deployFixture);

      expect(await c.supportsInterface("0xffffffff")).to.be.false;
      expect(await c.supportsInterface("0xd9b67a26")).to.be.true;
      expect(await c.supportsInterface("0x2a55205a")).to.be.true;
      expect(await c.supportsInterface("0x01ffc9a7")).to.be.true;
    });
  });

  describe("URI storing / updating", function () {
    it("Should set the correct mutableUri and immutableUri during deploy", async function () {
      const { c, mutableUri, immutableUri } = await loadFixture(deployFixture);
      expect(await c.proxyBaseUri()).to.equal(mutableUri);
      expect(await c.permanentBaseUri()).to.equal(immutableUri);
    });

    it("Should correcly update mutableUri via setProxyBaseUri()", async function () {
      const mutableUri2 = "2.mutable.uri";
      const { c, mutableUri } = await loadFixture(deployFixture);
      expect(await c.proxyBaseUri()).to.equal(mutableUri);
      await c.setProxyBaseUri(mutableUri2);
      expect(await c.proxyBaseUri()).to.equal(mutableUri2);
    });

    it("Should correcly update immutableUri via setPermanentBaseUriUpTo() and permanentBaseUriRanges + uriHistory to reflect this.", async function () {
      const period = "Init";
      const immutableUri2 = "immutable.uri.2/";
      const period2 = "Period2";
      const immutableUri3 = "immutable.uri.3/";
      const period3 = "Period3";

      const { c, immutableUri } = await loadFixture(deployFixture);

      await c.setInitialSupply([1, 1]);
      const input = await c.getMintRangeInput(101);
      await verified.mintPhotos(c, ...input);

      expect(await c.permanentBaseUri()).to.equal(immutableUri);
      await c.setPermanentBaseUriUpTo(immutableUri2, 100);
      await c.setPeriod(period2);

      expect(await c.permanentBaseUri()).to.equal(immutableUri2);

      const history = await c.permanentBaseUriRanges();

      expect(history.length).to.equal(2);
      const urls = history[0];
      expect(urls.length).to.equal(2);
      expect(urls[0]).to.equal(immutableUri);
      expect(urls[1]).to.equal(immutableUri2);

      // expect(history[1][0]).to.equal(period);
      // expect(history[1][1]).to.equal(period2);

      expect(history[1][0]).to.equal(0)
      expect(history[1][1]).to.equal(1)

      expect(await c.lastRangeTokenIdWithPermanentUri()).to.equal(100);

      await c.setPermanentBaseUriUpTo(immutableUri3, 101);
      await c.setPeriod(period3);

      const history2 = await c.permanentBaseUriRanges();
      expect(history2.length).to.equal(2);
      const urls2 = history2[0];
      expect(urls2.length).to.equal(3);
      expect(urls2[0]).to.equal(immutableUri);
      expect(urls2[1]).to.equal(immutableUri2);
      expect(urls2[2]).to.equal(immutableUri3);

      // expect(history2[1][0]).to.equal(period);
      // expect(history2[1][1]).to.equal(period2);
      // expect(history2[1][2]).to.equal(period3);

      expect(history2[1][0]).to.equal(0)
      expect(history2[1][1]).to.equal(1)
      expect(history2[1][2]).to.equal(101)
      expect(await c.lastRangeTokenIdWithPermanentUri()).to.equal(101);

      const history0 = await c.uriHistory(0);
      expect(history0.length).to.equal(3);
      expect(history0[0][0]).to.include(immutableUri);
      expect(history0[1][0]).to.include(immutableUri2);
      expect(history0[2][0]).to.include(immutableUri3);
      expect(history0[0][1]).to.include(period);
      expect(history0[1][1]).to.include(period2);
      expect(history0[2][1]).to.include(period3);

      const history1 = await c.uriHistory(1);
      expect(history1.length).to.equal(2);
      expect(history1[0][0]).to.include(immutableUri2);
      expect(history1[1][0]).to.include(immutableUri3);
      expect(history1[0][1]).to.include(period2);
      expect(history1[1][1]).to.include(period3);

      const history5 = await c.uriHistory(5);
      expect(history5.length).to.equal(2);
      expect(history5[0][0]).to.include(immutableUri2);
      expect(history5[1][0]).to.include(immutableUri3);
      expect(history5[0][1]).to.include(period2);
      expect(history5[1][1]).to.include(period3);

      const history101 = await c.uriHistory(101);
      expect(history101.length).to.equal(1);
      expect(history101[0][0]).to.include(immutableUri3);
      expect(history101[0][1]).to.include(period3);
    });

    it("Should require new permanentUri via setPermanentBaseUriUpTo() to be valid for more tokenIds than the last one and less than last minted one.", async function () {
      const period2 = "Period2";
      const period3 = "Period3";
      const immutableUri2 = "2.immutable.uri";
      const immutableUri3 = "3.immutable.uri";
      const { c, owner } = await loadFixture(deployFixture);

      await c.setInitialSupply([1, 1]);
      const input = await c.getMintRangeInput(101);
      await verified.mintPhotos(c, ...input);

      await expect(c.setPermanentBaseUriUpTo(immutableUri2, 0)).to.be.revertedWith("P:01");
      await c.setPermanentBaseUriUpTo(immutableUri2, 100);
      await expect(c.setPermanentBaseUriUpTo(immutableUri3, 100)).to.be.revertedWith("P:01");
      await c.setPermanentBaseUriUpTo(immutableUri3, 101);
      await expect(c.setPermanentBaseUriUpTo(immutableUri2, 102)).to.be.revertedWith("P:01");
    });

  });

  describe("tokenID <> date conversion", function () {
    type TokenIdTest = {
      tokenID: number,
      year: number,
      month: number,
      day: number
    }

    const tokenIDTests: TokenIdTest[] = [
      {
        tokenID: 1,
        year: 2022,
        month: 9,
        day: 1
      },
      {
        tokenID: 20,
        year: 2022,
        month: 9,
        day: 20
      },
      {
        tokenID: 524,
        year: 2024,
        month: 2,
        day: 6
      },
      {
        tokenID: 5824,
        year: 2038,
        month: 8,
        day: 11
      },
      {
        tokenID: 15824,
        year: 2065,
        month: 12,
        day: 27
      },
      {
        tokenID: 99999,
        year: 2296,
        month: 6,
        day: 14
      }
    ]

    async function testDate2TokenID(c: Ph101ppDailyPhoto, test: TokenIdTest) {
      const tokenSlug1 = await c.tokenSlugFromTokenId(test.tokenID);
      const tokenSlug2 = await c.tokenSlugFromDate(test.year, test.month, test.day);

      expect(tokenSlug1).to.equal(tokenSlug2);
      expect(tokenSlug1).to.include(test.month);
      expect(tokenSlug1).to.include(test.year);
      expect(tokenSlug1).to.include(test.day);
      expect(tokenSlug1).to.include(test.tokenID);
    }

    it("should correcty convert date string <> token ID", async function () {
      const { c } = await loadFixture(deployFixture);

      for (const i in tokenIDTests) {
        await testDate2TokenID(c, tokenIDTests[i]);
      }
      expect(
        await c.tokenSlugFromTokenId(0)
      ).to.include('CLAIM-0');
    });

    it("should fail to translate date before Sept 1, 2022 to tokenId", async function () {
      const { c } = await loadFixture(deployFixture);
      await expect(
        c.tokenSlugFromDate(2022, 8, 1)
      ).to.be.revertedWith('Project started September 1, 2022!');
    });

    it("should fail to translate date if invalid date (incl leap years)", async function () {
      const { c } = await loadFixture(deployFixture);
      await expect(
        c.tokenSlugFromDate(5138, 13, 17)
      ).to.be.revertedWith('Invalid date!');
      await expect(
        c.tokenSlugFromDate(2023, 2, 29)
      ).to.be.revertedWith('Invalid date!');
      await expect(
        c.tokenSlugFromDate(2025, 2, 29)
      ).to.be.revertedWith('Invalid date!');
      assert(
        await c.tokenSlugFromDate(2024, 2, 29),
        "20240229 should be valid date");
    });
  });

  describe("URI() for tokenIDs", function () {

    it("should return correct url for unminted tokenId:1 ", async function () {
      const tokenId = 1;
      const year = 2022;
      const month = 9;
      const day = 1;
      const tokenDate = `${year}${month <= 9 ? "0" : ""}${month}${day <= 9 ? "0" : ""}${day}`

      const { c, mutableUri } = await loadFixture(deployFixture);

      expect(await c.uri(tokenId)).to.equal(mutableUri + tokenDate + "-" + tokenId);
    });

    it("should return correct url for tokenId:0 (CLAIM) ", async function () {
      const tokenId = 0;
      const { c, immutableUri } = await loadFixture(deployFixture);
      expect(await c.uri(tokenId)).to.equal(immutableUri + "CLAIM-0");
    });

    it("should return immutable url for all minted nfts ", async function () {
      const { c, mutableUri, immutableUri } = await loadFixture(deployFixture);

      await c.setInitialSupply([0, 5]);
      const inputs = await c.getMintRangeInput(50);
      await verified.mintPhotos(c, ...inputs);
      await c.setPermanentBaseUriUpTo(immutableUri, 50);

      for (let i = 1; i < 100; i++) {
        if (i > 50) expect(await c.uri(i)).to.include(mutableUri);
        else expect(await c.uri(i)).to.include(immutableUri);
      }
    });

    it("should return mutable url for minted nfts after _uriValidUptoTokenId", async function () {
      const { c, mutableUri, immutableUri } = await loadFixture(deployFixture);

      await c.setInitialSupply([0, 5]);
      const inputs = await c.getMintRangeInput(50);
      await verified.mintPhotos(c, ...inputs);
      await c.setPermanentBaseUriUpTo(immutableUri, 10);

      for (let i = 1; i < 50; i++) {
        if (i > 10) expect(await c.uri(i)).to.include(mutableUri);
        else expect(await c.uri(i)).to.include(immutableUri);
      }
    });
  });


  describe("Periods & uriHistory", function () {

    it("should return correctly set Init period", async function () {
      const { c, mutableUri } = await loadFixture(deployFixture);

      expect(await c.period(0)).to.equal("Init");
    });

    it("Should correctly set Periods with setPeriod", async function () {
      const { c, account1, account2, account3, account4, account5, account6, account7, account8 } = await loadFixture(deployFixture);
      const period1 = "Period 1";
      const period2 = "Period 2";
      const period3 = "Period 3";

      await c.setPeriod(period1);
      const periodRanges = await c.periodRanges();
      expect(periodRanges.ranges.length).to.equal(1);
      expect(periodRanges.periods[0]).to.deep.equal(period1);

      expect(await c.period(1000)).to.deep.equal(period1);

      const inputs = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...inputs);

      await c.setPermanentBaseUriUpTo("uri2", 3);
      await c.setPeriod(period2);
      const periodRanges2 = await c.periodRanges();
      expect(periodRanges2.ranges.length).to.equal(2);
      expect(periodRanges2.periods[1]).to.deep.equal(period2);

      await c.setPermanentBaseUriUpTo("uri3", 5);
      await c.setPeriod(period3);
      const periodRanges3 = await c.periodRanges();
      expect(periodRanges3.ranges.length).to.equal(3);
      expect(periodRanges3.periods[2]).to.deep.equal(period3);

      expect(await c.period(1000)).to.deep.equal(period3);
    });

  });

  describe("Initial Supply ", function () {

    it("should fail to set max initial supply when paused", async function () {
      const { c } = await loadFixture(deployFixture);
      await c.pause();
      await expect(c.setInitialSupply([1, 5])).to.be.rejectedWith("Pausable: paused");
    });

    it("should fail to set initial supply with incorrect inputs", async function () {
      const { c } = await loadFixture(deployFixture);
      await expect(c.setInitialSupply([1])).to.be.rejectedWith("P:02");
      await expect(c.setInitialSupply([1, 5, 6])).to.be.rejectedWith("P:02");
      await expect(c.setInitialSupply([5, 1])).to.be.rejected;
    });

    // not checked anymore
    it.skip("Should invalidate mintRangeInput when maxInitialSupply is set", async function () {
      const { c } = await loadFixture(deployFixture);
      const initialSupply = [1, 5];
      const initialSupply2 = [1, 7];

      await c.setInitialSupply(initialSupply);
      let cIS = await c.initialSupply(1000);
      expect(cIS[0].eq(initialSupply[0]));
      expect(cIS[1].eq(initialSupply[1]));

      const inputs = await c.getMintRangeInput(5);
      await c.setInitialSupply(initialSupply2);
      await expect(verified.mintPhotos(c, ...inputs)).to.be.revertedWith("Invalid input. Use getMintRangeInput()");
    });

    it("Should correctly update initial supply via setInitialSupply", async function () {
      const { c } = await loadFixture(deployFixture);
      const initialSupply = [1, 5];
      const initialSupply2 = [1, 7];
      const initialSupply3 = [1, 20];

      await c.setInitialSupply(initialSupply);

      let cIS = await c.initialSupply(1000);
      expect(cIS[0].eq(initialSupply[0]));
      expect(cIS[1].eq(initialSupply[1]));

      const inputs = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...inputs);

      for (let i = 0; i < inputs[0].length; i++) {
        cIS = await c.initialSupply(inputs[0].ids[i]);
        expect(cIS[0].eq(initialSupply[0]));
        expect(cIS[1].eq(initialSupply[1]));
      }

      await c.setInitialSupply(initialSupply3);
      cIS = await c.initialSupply(1000);
      expect(cIS[0].eq(initialSupply3[0]));
      expect(cIS[1].eq(initialSupply3[1]));

      await c.setInitialSupply(initialSupply2);

      cIS = await c.initialSupply(1000);
      expect(cIS[0].eq(initialSupply2[0]));
      expect(cIS[1].eq(initialSupply2[1]));

      const inputs2 = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...inputs2);
      for (let i = 0; i < inputs2[0].length; i++) {
        cIS = await c.initialSupply(inputs2[0].ids[i]);
        expect(cIS[0].eq(initialSupply2[0]));
        expect(cIS[1].eq(initialSupply2[1]));
      }

    });

    it("Should correctly update initial supply with setInitialHolders 2", async function () {
      const { c, account1, account2, account3, account4, account5, account6, account7, account8 } = await loadFixture(deployFixture);
      const initialSupply = [1, 5];
      const initialSupply2 = [1, 7];
      const initialSupply3 = [1, 20];
      const initialSupply4 = [1, 12];

      await c.setInitialSupply(initialSupply);

      const holderRanges = await c.initialSupplyRanges();
      expect(holderRanges.ranges.length).to.equal(1);
      expect(holderRanges.supplies[0]).to.deep.equal(initialSupply);

      await c.setInitialSupply(initialSupply2);
      const holderRanges2 = await c.initialSupplyRanges();
      expect(holderRanges2.ranges.length).to.equal(1);
      expect(holderRanges2.supplies[0]).to.deep.equal(initialSupply2);

      expect(await c.initialSupply(1000)).to.deep.equal(initialSupply2);

      const inputs = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...inputs);

      await c.setInitialSupply(initialSupply3);
      const holderRanges3 = await c.initialSupplyRanges();
      expect(holderRanges3.ranges.length).to.equal(2);
      expect(holderRanges3.supplies[1]).to.deep.equal(initialSupply3);

      await c.setInitialSupply(initialSupply4);
      const holderRanges4 = await c.initialSupplyRanges();
      expect(holderRanges4.ranges.length).to.equal(2);
      expect(holderRanges4.supplies[1]).to.deep.equal(initialSupply4);

      expect(await c.initialSupply(1000)).to.deep.equal(initialSupply4);
    });

    it("Should distribute tokens evenly within min/max supply range", async function () {
      const { c } = await loadFixture(deployFixture);

      const mints = 500;
      const testSuppliesTo = 8;
      const acceptedVariance = 0.6;

      for (let i = 1; i <= testSuppliesTo; i++) {
        const supply = [10, 10 + i];
        await c.setInitialSupply(supply);
        const inputs = await c.getMintRangeInput(mints);
        const treasuryBalances = inputs[0].amounts[0];
        const balanceDistribution: { [key: number]: number } = {};

        for (let k = 0; k < mints; k++) {
          expect(treasuryBalances[k]).to.lte(supply[1])
          expect(treasuryBalances[k]).to.gte(supply[0])

          balanceDistribution[treasuryBalances[k].toNumber()] = balanceDistribution[treasuryBalances[k].toNumber()] ?? 0;
          balanceDistribution[treasuryBalances[k].toNumber()]++;
        }
        expect(balanceDistribution[0]).to.equal(undefined);

        for (let k = supply[0]; k < supply[1]; k++) {
          expect(balanceDistribution[k]).to.be.gte(acceptedVariance * mints / (supply[1] - supply[0] + 1));
        }
      }

    });
  })

  describe("Mint Photos", function () {
    it("should fail to mint <= 0 tokens", async function () {
      const { c, vault, treasury } = await loadFixture(deployFixture);

      expect(await c.lastRangeTokenIdMinted()).to.equal(0);
      await c.setInitialSupply([1, 2]);
      await expect(c.getMintRangeInput(-1)).to.be.rejected;

      const input = await c.getMintRangeInput(0);
      await expect(verified.mintPhotos(c, ...input)).to.be.rejected;
    });

    it("should mint 1 vault and up to max supply to treasury ", async function () {
      const { c, vault, treasury } = await loadFixture(deployFixture);
      const photos = 1000;
      const maxSupply = [1, 2];
      await c.setInitialSupply(maxSupply);
      const [input, checksum] = await c.getMintRangeInput(photos);
      const vaultAddresses = new Array(photos).fill(vault.address);
      const treasuryAddresses = new Array(photos).fill(treasury.address);
      const tx = await verified.mintPhotos(c, input, checksum);
      const receipt = await tx.wait();
      const ids = input[0];
      const vaultBalances = await c.balanceOfBatch(vaultAddresses, ids);
      const treasuryBalances = await c.balanceOfBatch(treasuryAddresses, ids);

      const transferEvents = receipt.events?.filter(e => e.event === "TransferBatch") || [];

      expect(transferEvents?.length).to.equal(2);

      for (let i = 0; i < (transferEvents?.length ?? 0); i++) {
        const event = transferEvents?.[i]!;
        expect(input[1][i]).to.deep.equal(event.args?.[4]);
      }

      for (let i = 0; i < photos; i++) {
        expect(vaultBalances[i]).to.equal(1);
        expect(vaultBalances[i]).to.equal(input[1][1][i]);
        expect(treasuryBalances[i]).to.equal(input[1][0][i]);
        expect(treasuryBalances[i]).to.lte(maxSupply[1]);
        expect(treasuryBalances[i]).to.gte(maxSupply[0]);
      }

      expect(await c.balanceOf(treasury.address, photos + 1)).to.equal(0)
      expect(await c.balanceOf(vault.address, photos + 1)).to.equal(0)

    });
  })

  describe("Claim tokens", function () {
    it("should mint 10 claim tokens to treasury wallet ", async function () {
      const { c, treasury, vault } = await loadFixture(deployFixture);
      expect(await c.balanceOf(treasury.address, 0)).to.equal(10);
      expect(await c.balanceOf(vault.address, 0)).to.equal(0);
    });

    it("should mint claim tokens to any wallet ", async function () {
      const { c, treasury, account1 } = await loadFixture(deployFixture);

      await verified.mintClaims(c, account1.address, 2, []);

      expect(await c.totalSupply(0)).to.equal(12);
      expect(await c.balanceOf(treasury.address, 0)).to.equal(10);
      expect(await c.balanceOf(account1.address, 0)).to.equal(2);

    });

    it("should claim mints from treasury and burn claims when redeemClaims is called", async function () {

      const { c, treasury, vault, account1, account2 } = await loadFixture(deployFixture);

      await c.setInitialSupply([1, 1]);
      const input1 = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...input1);

      const newTreasury = account2.address
      await c.setInitialHolders(newTreasury, vault.address);

      const input2 = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...input2);

      await verified.connect(treasury).safeTransferFrom(c, treasury.address, account1.address, 0, 2, []);

      expect(await c.balanceOf(account1.address, 0)).to.equal(2);

      await expect(c.connect(account1).redeemClaims([8, 9, 7], [1, 1, 1])).to.be.rejected;
      await expect(c.connect(account1).redeemClaims([8], [1, 1])).to.be.rejected;
      await expect(c.connect(account1).redeemClaims([8, 9], [1])).to.be.rejected;
      await expect(c.connect(account1).redeemClaims([8, 2], [1, 1])).to.be.rejected;
      await c.connect(account1).redeemClaims([4, 2], [1, 1]);

      expect(await c.balanceOf(account1.address, 0)).to.equal(0);
      expect(await c.balanceOf(account1.address, 2)).to.equal(1);
      expect(await c.balanceOf(account1.address, 4)).to.equal(1);

      expect(await c.balanceOf(treasury.address, 2)).to.equal(0);
      expect(await c.balanceOf(treasury.address, 4)).to.equal(0);
    });

    it("should claim mint from treasury and burn claim when redeemClaim is called", async function () {

      const { c, treasury, vault, account1, account2 } = await loadFixture(deployFixture);
      await c.setInitialSupply([1, 1]);

      const input1 = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...input1);

      const newTreasury = account2.address
      await c.setInitialHolders(newTreasury, vault.address);

      const input2 = await c.getMintRangeInput(5);
      await verified.mintPhotos(c, ...input2);

      await verified.connect(treasury).safeTransferFrom(c, treasury.address, account1.address, 0, 2, []);

      expect(await c.balanceOf(account1.address, 0)).to.equal(2);

      await c.connect(account1).redeemClaims([8], [1]);
      await c.connect(account1).redeemClaims([2], [1]);

      expect(await c.balanceOf(account1.address, 0)).to.equal(0);
      expect(await c.balanceOf(account1.address, 2)).to.equal(1);
      expect(await c.balanceOf(account1.address, 8)).to.equal(1);

      expect(await c.balanceOf(treasury.address, 2)).to.equal(0);
      expect(await c.balanceOf(newTreasury, 8)).to.equal(0);
    });

  });

  describe("Update initial holders / getPh101ppDailyPhotoUpdateInitialHoldersInput", function () {
    it("should correcly update vault address only", async function () {
      const { c, vault, treasury, account1, account2 } = await loadFixture(deployFixture);
      const photos = 10;
      const maxSupply = [5, 5];

      await c.setInitialSupply(maxSupply);

      const input = await c.getMintRangeInput(photos);

      const vaultAddresses = new Array(photos).fill(vault.address);
      const treasuryAddresses = new Array(photos).fill(treasury.address);

      await verified.mintPhotos(c, ...input);
      const ids = input[0].ids;
      const vaultBalances = await c.balanceOfBatch(vaultAddresses, ids);
      const treasuryBalances = await c.balanceOfBatch(treasuryAddresses, ids);

      for (let i = 0; i < photos; i++) {
        expect(vaultBalances[i]).to.equal(1);
        expect(treasuryBalances[i]).to.equal(5);
      }


      // transfer token 3
      await verified.connect(vault).safeTransferFrom(c, vault.address, account2.address, 3, 1, []);

      await c.pause();
      const updateInitialHoldersInput = await getPh101ppDailyPhotoUpdateInitialHoldersInput(c, treasury.address, account1.address);

      const tx = await verified.pdpUpdateInitialHolders(c, ...updateInitialHoldersInput);
      const receipt = await tx.wait();

      const newVaultAddresses = new Array(photos).fill(account1.address);
      const newTreasuryBalances = await c.balanceOfBatch(treasuryAddresses, ids);
      const newVaultBalances = await c.balanceOfBatch(newVaultAddresses, ids);
      const newOldVaultBalances = await c.balanceOfBatch(vaultAddresses, ids);

      for (let i = 0; i < photos; i++) {
        if (i + 1 == 3) {
          expect((await c.balanceOf(vault.address, 3)).toNumber()).to.equal(0)
          expect((await c.balanceOf(account2.address, 3)).toNumber()).to.equal(1)

          expect((await c.balanceOf(account1.address, 3)).toNumber()).to.equal(0)
          expect((await c.balanceOf(treasury.address, 3)).toNumber()).to.equal(5)
        }
        else {
          expect(newVaultBalances[i]).to.equal(1);
          expect(newOldVaultBalances[i]).to.equal(0);
          expect(treasuryBalances[i]).to.equal(newTreasuryBalances[i]);
        }
      }

      expect(receipt.events?.filter(e => e.event === "TransferBatch").length).to.equal(1);
      expect(receipt.events?.filter(e => e.args?.from && e.args?.to && e.args?.from === e.args?.to).length).to.equal(0);
    });

    it("should correcly update treasury address only", async function () {
      const { c, vault, treasury, account1 } = await loadFixture(deployFixture);
      const photos = 10;
      const maxSupply = [1, 5];
      await c.setInitialSupply(maxSupply);
      const input = await c.getMintRangeInput(photos);

      const vaultAddresses = new Array(photos).fill(vault.address);
      const treasuryAddresses = new Array(photos).fill(treasury.address);

      await verified.mintPhotos(c, ...input);
      const ids = input[0].ids;
      const vaultBalances = await c.balanceOfBatch(vaultAddresses, ids);
      const treasuryBalances = await c.balanceOfBatch(treasuryAddresses, ids);

      for (let i = 0; i < photos; i++) {
        expect(vaultBalances[i]).to.equal(1);
        expect(treasuryBalances[i]).to.gte(1);
      }

      await c.pause();
      const updateInitialHoldersInput = await getPh101ppDailyPhotoUpdateInitialHoldersInput(c, account1.address, vault.address);

      const tx = await verified.pdpUpdateInitialHolders(c, ...updateInitialHoldersInput);
      const receipt = await tx.wait();

      const newTreasuryAddresses = new Array(photos).fill(account1.address);
      const newTreasuryBalances = await c.balanceOfBatch(newTreasuryAddresses, ids);
      const newOldTreasuryBalances = await c.balanceOfBatch(treasuryAddresses, ids);
      const newVaultBalances = await c.balanceOfBatch(vaultAddresses, ids);

      for (let i = 0; i < photos; i++) {
        expect(newVaultBalances[i]).to.equal(1);
        expect(newOldTreasuryBalances[i]).to.equal(0);
        expect(treasuryBalances[i]).to.equal(newTreasuryBalances[i]);
      }

      expect(receipt.events?.filter(e => e.event === "TransferBatch").length).to.equal(1);
      expect(receipt.events?.filter(e => e.args?.from && e.args?.to && e.args?.from === e.args?.to).length).to.equal(0);
    });

    it("should correcly swap treasury and vault addresses", async function () {
      const { c, vault, treasury } = await loadFixture(deployFixture);
      const photos = 10;
      const maxSupply = [1, 5];
      await c.setInitialSupply(maxSupply);
      const input = await c.getMintRangeInput(photos);

      const vaultAddresses = new Array(photos).fill(vault.address);
      const treasuryAddresses = new Array(photos).fill(treasury.address);

      await verified.mintPhotos(c, ...input);
      const ids = input[0].ids;
      const vaultBalances = await c.balanceOfBatch(vaultAddresses, ids);
      const treasuryBalances = await c.balanceOfBatch(treasuryAddresses, ids);

      for (let i = 0; i < photos; i++) {
        expect(vaultBalances[i]).to.equal(1);
        expect(treasuryBalances[i]).to.gte(1);
      }

      await c.pause();
      const updateInitialHoldersInput = await getPh101ppDailyPhotoUpdateInitialHoldersInput(c, vault.address, treasury.address);

      const integrity = await integrityCheck(c).range([treasury.address, vault.address], 0, 9)
      const supplyCheck = await integrity.supplies()
      const balancesCheck = await integrity.balances()

      // await verified.pdpUpdateInitialHolders(c, ...updateInitialHoldersInput);
      await expect(c.updateInitialHolders(...updateInitialHoldersInput)).to.not.be.rejected;

      const newTreasuryBalances = await c.balanceOfBatch(vaultAddresses, ids);
      const newVaultBalances = await c.balanceOfBatch(treasuryAddresses, ids);

      for (let i = 0; i < photos; i++) {
        expect(newVaultBalances[i]).to.equal(vaultBalances[i]);
        expect(newTreasuryBalances[i]).to.equal(treasuryBalances[i]);
      }

      await supplyCheck.expectEqual();

      const updateInitialHoldersInput2 = await getPh101ppDailyPhotoUpdateInitialHoldersInput(c, treasury.address, vault.address);
      await expect(c.updateInitialHolders(...updateInitialHoldersInput2)).to.not.be.rejected;

      await balancesCheck.expectEqual();
      await supplyCheck.expectEqual();
    });

    it("should fail to updated initialHolders if isInitialHoldersRangeUpdatePermanentlyDisabled", async function () {
      const { c, account1, account2 } = await loadFixture(deployFixture);
      const photos = 10;
      const maxSupply = [1, 5];

      await c.setInitialSupply(maxSupply);
      const input = await c.getMintRangeInput(photos);
      await verified.mintPhotos(c, ...input);
      await c.permanentlyDisableInitialHoldersRangeUpdate();
      await c.pause();
      const updateInitialHoldersInput = await getPh101ppDailyPhotoUpdateInitialHoldersInput(c, account2.address, account1.address);
      await expect(verified.pdpUpdateInitialHolders(c, ...updateInitialHoldersInput)).to.be.rejectedWith("P:03");
      expect(await c.isInitialHoldersRangeUpdatePermanentlyDisabled()).to.be.true;
    })
  });

  describe("ERC2981 Token Royalties", function () {

    it("should set default royalties during deploy", async function () {
      const { c, owner } = await loadFixture(deployFixture);
      expect(await c.royaltyInfo(0, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(1, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(100, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(1000, 100)).to.deep.equal([owner.address, 5]);
    });

    it("should be able to set new default royalties", async function () {
      const { c, owner, account1 } = await loadFixture(deployFixture);
      await c.setDefaultRoyalty(account1.address, 100);
      expect(await c.royaltyInfo(0, 100)).to.deep.equal([account1.address, 1]);
      expect(await c.royaltyInfo(1, 100)).to.deep.equal([account1.address, 1]);
      expect(await c.royaltyInfo(100, 100)).to.deep.equal([account1.address, 1]);
      expect(await c.royaltyInfo(1000, 100)).to.deep.equal([account1.address, 1]);

      await c.setDefaultRoyalty(owner.address, 0);
      expect(await c.royaltyInfo(0, 100)).to.deep.equal([owner.address, 0]);
      expect(await c.royaltyInfo(1, 100)).to.deep.equal([owner.address, 0]);
      expect(await c.royaltyInfo(100, 100)).to.deep.equal([owner.address, 0]);
      expect(await c.royaltyInfo(1000, 100)).to.deep.equal([owner.address, 0]);
    });

    it("should be able to set and reset royalties for single token", async function () {
      const { c, owner, account1 } = await loadFixture(deployFixture);
      await c.setTokenRoyalty(1, account1.address, 10000);
      await c.setTokenRoyalty(2, account1.address, 50);
      await c.setTokenRoyalty(3, account1.address, 100);
      expect(await c.royaltyInfo(0, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(1, 100)).to.deep.equal([account1.address, 100]);
      expect(await c.royaltyInfo(2, 100)).to.deep.equal([account1.address, 0]);
      expect(await c.royaltyInfo(3, 100)).to.deep.equal([account1.address, 1]);
      expect(await c.royaltyInfo(4, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(1000, 100)).to.deep.equal([owner.address, 5]);

      await c.resetTokenRoyalty(2);
      await c.resetTokenRoyalty(3);

      expect(await c.royaltyInfo(0, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(1, 100)).to.deep.equal([account1.address, 100]);
      expect(await c.royaltyInfo(2, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(3, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(4, 100)).to.deep.equal([owner.address, 5]);
      expect(await c.royaltyInfo(1000, 100)).to.deep.equal([owner.address, 5]);

    });

  });

  describe("Ownable / Ownable", function () {

    it("should fail to execute access guarded functions without role", async function () {
      const { c, account1 } = await loadFixture(deployFixture);
      await c.pause();
      const updateInitialHoldersInput = await getPh101ppDailyPhotoUpdateInitialHoldersInput(c, account1.address, account1.address);
      await expect(c.connect(account1).updateInitialHolders(...updateInitialHoldersInput)).to.be.rejectedWith("Ownable");
      await c.unpause();
      await c.setInitialSupply([1, 4]);
      const mintInput = await c.getMintRangeInput(4);
      await expect(c.connect(account1).mintPhotos(...mintInput)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).mintClaims(account1.address, 5, [])).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setInitialHolders(account1.address, account1.address)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).pause()).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).unpause()).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setPermanentBaseUriUpTo("", 100)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setProxyBaseUri("")).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setDefaultRoyalty(account1.address, 100)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setTokenRoyalty(1, account1.address, 100)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).resetTokenRoyalty(1)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setOperatorFilterRegistryAddress(account1.address)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setLockInitialHoldersUpTo(0)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setInitialSupply([1, 2])).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).transferOwnership(account1.address)).to.be.rejectedWith("Ownable");
      await expect(c.connect(account1).permanentlyDisableInitialHoldersRangeUpdate()).to.be.rejectedWith("Ownable");
    });

    it("should execute access guarded functions with special role", async function () {
      const { c, account1, account2, account3, account4 } = await loadFixture(deployFixture);

      await c.transferOwnership(account1.address);
      await c.connect(account1).pause();
      const updateInitialHoldersInput = await getPh101ppDailyPhotoUpdateInitialHoldersInput(c, account1.address, account1.address);
      await expect(c.connect(account1).updateInitialHolders(...updateInitialHoldersInput)).to.not.be.rejectedWith("Ownable");
      await c.connect(account1).unpause();
      await expect(c.connect(account1).setInitialHolders(account1.address, account1.address)).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setLockInitialHoldersUpTo(0)).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).permanentlyDisableInitialHoldersRangeUpdate()).to.not.be.rejectedWith("Ownable");

      await expect(c.connect(account1).pause()).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).unpause()).to.not.be.rejectedWith("Ownable");

      await expect(c.connect(account1).setDefaultRoyalty(account1.address, 100)).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setTokenRoyalty(1, account1.address, 100)).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).resetTokenRoyalty(1)).to.not.be.rejectedWith("Ownable");

      await expect(c.connect(account1).transferOwnership(account1.address)).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setOperatorFilterRegistryAddress(account1.address)).to.not.be.rejectedWith("Ownable");

      // await c.grantRole(await c.PHOTO_MINTER_ROLE(), account2.address);
      await c.connect(account1).setInitialSupply([1, 4]);
      const mintInput = await c.getMintRangeInput(4);
      await expect(c.connect(account1).setInitialSupply([1, 2])).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).mintPhotos(...mintInput)).to.not.be.rejectedWith("Ownable");

      // await c.grantRole(await c.CLAIM_MINTER_ROLE(), account3.address);
      await expect(c.connect(account1).mintClaims(account1.address, 5, [])).to.not.be.rejectedWith("Ownable");

      // await c.grantRole(await c.URI_UPDATER_ROLE(), account4.address);
      await expect(c.connect(account1).setPermanentBaseUriUpTo("", 100)).to.not.be.rejectedWith("Ownable");
      await expect(c.connect(account1).setProxyBaseUri("")).to.not.be.rejectedWith("Ownable");
    });

    it("should fail execute non-view functions when paused", async function () {
      const { c, account1, account2, account3, account4 } = await loadFixture(deployFixture);
      await c.setInitialSupply([1, 4]);
      const mintInput = await c.getMintRangeInput(4);

      await c.pause();
      await expect(c.setInitialHolders(account1.address, account1.address)).to.be.rejectedWith("paused");
      await expect(c.setLockInitialHoldersUpTo(0)).to.be.rejectedWith("paused");
      await expect(c.permanentlyDisableInitialHoldersRangeUpdate()).to.be.rejectedWith("paused");

      await expect(c.pause()).to.be.rejectedWith("paused");

      await expect(c.setDefaultRoyalty(account1.address, 100)).to.be.rejectedWith("paused");
      await expect(c.setTokenRoyalty(1, account1.address, 100)).to.be.rejectedWith("paused");
      await expect(c.resetTokenRoyalty(1)).to.be.rejectedWith("paused");

      // await expect(c.transferOwnership(account1.address)).to.be.rejectedWith("paused");
      await expect(c.setOperatorFilterRegistryAddress(account1.address)).to.be.rejectedWith("paused");
      await expect(c.setApprovalForAll(account1.address, true)).to.be.rejectedWith("paused");

      await expect(c.setInitialSupply([1, 2])).to.be.rejectedWith("paused");
      await expect(verified.mintPhotos(c, ...mintInput)).to.be.rejectedWith("paused");

      await expect(verified.mintClaims(c, account1.address, 5, [])).to.be.rejectedWith("paused");
      // await expect(c.redeemClaims([2], [5])).to.be.rejectedWith("paused");
      await expect(c.redeemClaims([2], [5])).to.be.rejectedWith("paused");

      await expect(c.setPermanentBaseUriUpTo("", 100)).to.be.rejectedWith("paused");
      await expect(c.setProxyBaseUri("")).to.be.rejectedWith("paused");
    });

    it("should be possible to update owner via setOwner", async function () {
      const { c, owner, account1, account2, account3, account4 } = await loadFixture(deployFixture);
      expect(await c.owner()).to.equal(owner.address);
      await c.transferOwnership(account1.address);
      expect(await c.owner()).to.equal(account1.address);
    })
  });

  describe("Operator Filter Registry", function () {

    it("should correctly register contract with Operator Filter Registry and subscribe to opensea", async function () {
      const { c, ofr } = await loadFixture(deployFixture);
      expect(await c.operatorFilterRegistryAddress()).to.equal("0x000000000000AAeB6D7670E522A718067333cd4E");
      await ofr.registerAndSubscribe(c.address, "0x3cc6CddA760b79bAfa08dF41ECFA224f810dCeB6");
      expect(await ofr.isRegistered(c.address)).to.be.true;
      expect(await ofr.subscriptionOf(c.address)).to.equal("0x3cc6CddA760b79bAfa08dF41ECFA224f810dCeB6");

    });

    it("should prevent filtered operator to transfer tokens (+ disable / disablePermanently)", async function () {
      const { c, ofr, treasury, account1, account2 } = await loadFixture(deployFixture);

      await ofr.registerAndSubscribe(c.address, "0x3cc6CddA760b79bAfa08dF41ECFA224f810dCeB6");

      const subscribedFilteredOperators = await ofr.filteredOperators(c.address);
      await ofr.unsubscribe(c.address, true);
      const unsubscribedfilteredOperators = await ofr.filteredOperators(c.address);
      expect(unsubscribedfilteredOperators).to.be.deep.equal(subscribedFilteredOperators);

      // set approve operator
      await c.connect(treasury).setApprovalForAll(account1.address, true);
      await expect(verified.connect(treasury).safeTransferFrom(c, treasury.address, account2.address, 0, 1, [])).to.not.be.rejected;
      await expect(verified.connect(account1).safeTransferFrom(c, treasury.address, account2.address, 0, 1, [])).to.not.be.rejected;

      // filter operator
      await ofr.updateOperator(c.address, account1.address, true);
      expect(await ofr.filteredOperators(c.address)).to.include(account1.address);

      await expect(verified.connect(account1).safeTransferFrom(c, treasury.address, account2.address, 0, 1, [])).to.be.reverted;

      // disable operator filter by setting operator filter to address();
      await c.setOperatorFilterRegistryAddress(ethers.constants.AddressZero);
      await expect(verified.connect(account1).safeTransferFrom(c, treasury.address, account2.address, 0, 1, [])).to.not.be.reverted;
      await c.setOperatorFilterRegistryAddress("0x000000000000AAeB6D7670E522A718067333cd4E");
      await expect(verified.connect(account1).safeTransferFrom(c, treasury.address, account2.address, 0, 1, [])).to.be.reverted;

      // permanently disable operator filter
      await c.setOperatorFilterRegistryAddress(ethers.constants.AddressZero);
      await c.permanentlyFreezeOperatorFilterRegistryAddress();
      await expect(verified.connect(account1).safeTransferFrom(c, treasury.address, account2.address, 0, 1, [])).to.not.be.reverted;
      await expect(c.setOperatorFilterRegistryAddress(ethers.constants.AddressZero)).to.be.revertedWith("O:01");
    });
  });

  describe("Transfer Listener", function () {

    it("should correcly set transfer listener via setTransferListenerAddress", async function () {
      const { c, pdpl } = await loadFixture(deployFixture);
      expect(await c.transferEventListenerAddress()).to.equal(ethers.constants.AddressZero);
      await c.setTransferEventListenerAddress(pdpl.address);
      expect(await c.transferEventListenerAddress()).to.equal(pdpl.address);
    });

    it("should fail to set transfer listener via setTransferListenerAddress when frozen", async function () {
      const { c, pdpl, account1 } = await loadFixture(deployFixture);
      expect(await c.transferEventListenerAddress()).to.equal(ethers.constants.AddressZero);
      await c.setTransferEventListenerAddress(pdpl.address);
      expect(await c.transferEventListenerAddress()).to.equal(pdpl.address);

      await c.permanentlyFreezeTransferEventListenerAddress();

      expect(await c.transferEventListenerAddress()).to.equal(pdpl.address);
      await expect(c.setTransferEventListenerAddress(account1.address)).to.be.revertedWith("P:04");

    });

    it("should emit Ph101ppDailyPhotoTransferReceived from Listener on transfer", async function () {
      const { c, pdpl, treasury, account1 } = await loadFixture(deployFixture);

      await c.setTransferEventListenerAddress(pdpl.address);

      await expect(verified.connect(treasury).safeTransferFrom(c, treasury.address, treasury.address, 0, 1, [])).to.be.revertedWith("Test Revert");
      await expect(verified.connect(treasury).safeTransferFrom(c, treasury.address, account1.address, 0, 1, [])).to.not.be.reverted;

      const tx = await verified.connect(treasury).safeTransferFrom(c, treasury.address, account1.address, 0, 1, []);
      const receipt = await tx.wait();

      let event;
      for (let i = 0; i < (receipt?.events?.length ?? 0); i++) {
        const e = receipt.events?.[i]!;
        try {
          event = await pdpl.interface.decodeEventLog("Ph101ppDailyPhotoTransferReceived", e.data);
          break;
        }
        catch (e) { }
      }
      if (!event) {
        return expect(event, "expected event not to be undefined").to.not.be.undefined;
      }
      expect(event.sender).to.equal(c.address);
      expect(event.operator).to.equal(treasury.address);
      expect(event.from).to.equal(treasury.address);
      expect(event.to).to.equal(account1.address);
      expect(event.ids[0].toNumber()).to.equal(0);
      expect(event.amounts[0].toNumber()).to.equal(1);
    });

  });


}

