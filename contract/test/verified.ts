import { ethers } from "hardhat";
import { ERC1155MintRange, ERC1155MintRangeUpdateable, Ph101ppDailyPhoto, TestERC1155MintRange, TestERC1155MintRangePausable, TestERC1155MintRangeUpdateable } from "../typechain-types";
import { SignerWithAddress } from "./fixture";
import integrityCheck from "./integrityCheck"

export type Contracts = TestERC1155MintRange | TestERC1155MintRangePausable | TestERC1155MintRangeUpdateable;
// type CheckTransfersMintRange = (initialHolders: string[], input: ERC1155MintRange.MintRangeInputStructOutput) => Promise<TransferCheck>
// type CheckTransfersUpdateInitialHolderRangess = (input: ERC1155MintRangeUpdateable.UpdateInitialHolderRangesInputStructOutput) => Promise<TransferCheck>

const verified = {
  mint: async (c: Contracts, to: string, tokenId: number, amount: number, data: []) => {
    const transfers = await integrityCheck(c).transferSingle(ethers.constants.AddressZero, to, tokenId, amount);
    const tx = await c.mint(to, tokenId, amount, data);
    await transfers.expectSuccess(tx, { expectSupplyChange: true });
    return tx;
  },
  mintBatch: async (c: Contracts, to: string, tokenIds: number[], amounts: number[], data: []) => {
    const transfers = await integrityCheck(c).transferBatch(ethers.constants.AddressZero, to, tokenIds, amounts);
    const tx = await c.mintBatch(to, tokenIds, amounts, data);
    await transfers.expectSuccess(tx, { expectSupplyChange: true });
    return tx;
  },
  connect: (operator: SignerWithAddress) => ({
    safeTransferFrom: async (c: Contracts | Ph101ppDailyPhoto, from: string, to: string, tokenId: number, amount: number, data: []) => {
      const transfers = await integrityCheck(c).transferSingle(from, to, tokenId, amount);
      const tx = await c.connect(operator).safeTransferFrom(from, to, tokenId, amount, data);
      await transfers.expectSuccess(tx, { expectSupplyChange: false });
      return tx;
    },
    safeBatchTransferFrom: async (c: Contracts | Ph101ppDailyPhoto, from: string, to: string, tokenIds: number[], amounts: number[], data: []) => {
      const transfers = await integrityCheck(c).transferBatch(from, to, tokenIds, amounts);
      const tx = await c.connect(operator).safeBatchTransferFrom(from, to, tokenIds, amounts, data);
      await transfers.expectSuccess(tx, { expectSupplyChange: false });
      return tx;
    }
  }),
  mintRange: async (c: Contracts, input: ERC1155MintRange.MintRangeInputStructOutput) => {
    const lastIndex = await c.lastRangeTokenIdMinted();
    const initialHolders = await c.initialHolders(lastIndex.toNumber()+1);
    const transfers = await integrityCheck(c).transfersMintRange(initialHolders, input);
    const tx = await c.mintRange(input);
    await transfers.expectSuccess(tx, { expectSupplyChange: true });
    return tx;
  },
  mintRangeSafe: async (c: Contracts, input: ERC1155MintRange.MintRangeInputStructOutput, checksum: string) => {
    const lastIndex = await c.lastRangeTokenIdMinted();
    const initialHolders = await c.initialHolders(lastIndex.toNumber()+1);
    const transfers = await integrityCheck(c).transfersMintRange(initialHolders, input);
    const tx = await c.mintRangeSafe(input, checksum);
    await transfers.expectSuccess(tx, { expectSupplyChange: true });
    return tx;
  },
  updateInitialHolderRanges: async (c: TestERC1155MintRangeUpdateable, input: ERC1155MintRangeUpdateable.UpdateInitialHolderRangesInputStruct) => {
    const transfers = await integrityCheck(c).transfersUpdateInitialHolderRanges(input);
    const tx = await c.updateInitialHolderRanges(input);
    await transfers.expectSuccess(tx, { expectSupplyChange: false });
    return tx;
  },
  updateInitialHolderRangesSafe: async (c: TestERC1155MintRangeUpdateable, input: ERC1155MintRangeUpdateable.UpdateInitialHolderRangesInputStruct, checksum:string) => {
    const transfers = await integrityCheck(c).transfersUpdateInitialHolderRanges(input);
    const tx = await c.updateInitialHolderRangesSafe(input, checksum);
    await transfers.expectSuccess(tx, { expectSupplyChange: false });
    return tx;
  },
  pdpUpdateInitialHolderRanges: async (c: Ph101ppDailyPhoto, input: ERC1155MintRangeUpdateable.UpdateInitialHolderRangesInputStruct, checksum:string) => {
    const transfers = await integrityCheck(c).transfersUpdateInitialHolderRanges(input);
    const tx = await c.updateInitialHolderRanges(input, checksum);
    await transfers.expectSuccess(tx, { expectSupplyChange: false });
    return tx;  
  },
  mintClaims:  async (c: Ph101ppDailyPhoto, to: string, amount: number, data: []) => {
    const claimTokenID = await c.CLAIM_TOKEN_ID();
    const transfers = await integrityCheck(c).transferSingle(ethers.constants.AddressZero, to, claimTokenID.toNumber(), amount);
    const tx = await c.mintClaims(to, amount, data);
    await transfers.expectSuccess(tx, { expectSupplyChange: true });
    return tx;
  },
  mintPhotos: async (c: Ph101ppDailyPhoto, input: ERC1155MintRange.MintRangeInputStructOutput, checksum: string) => {
    const lastIndex = await c.lastRangeTokenIdMinted();
    const initialHolders = await c.initialHolders(lastIndex.toNumber()+1);
    const transfers = await integrityCheck(c).transfersMintRange(initialHolders, input);
    const tx = await c.mintPhotos(input, checksum);
    await transfers.expectSuccess(tx, { expectSupplyChange: true });
    return tx;
  },
}

export default verified;