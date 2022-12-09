// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC1155/extensions/ERC1155Supply.sol)

pragma solidity ^0.8.0;

import "./ERC1155_.sol";
import "./DateTime.sol";

/**
 * @dev Extension of ERC1155 enables mintRange with dynamic initial balance
 * and adds tracking of total supply per id.
 */
abstract contract ERC1155MintRange is ERC1155_ {

    // Mapping from token ID to balancesInitialzed flag
    mapping(uint => mapping(address => bool)) public isBalanceInitialized;

    // Mapping from token ID to totalSupplyDelta
    mapping(uint => int256) private _totalSupplyDelta;

    // Mapping to keep track of tokens minted via ERC1155._mint() or  ERC1155._mintBatch()
    mapping(uint => bool) public isManualMint;
    // used to check validity of mintRangeInput
    uint private _manualMintsCount;

    // Track initial holders across tokenID ranges + lookup mapping;
    address[][] internal _initialHolders;
    uint[] internal _initialHoldersRange;
    mapping(uint => mapping(address => bool)) internal _initialHoldersMappings;

    // last tokenId minted via mintRange.
    uint public lastRangeTokenIdMinted;
    bool public isZeroMinted;

    constructor(address[] memory initialInitialHolders) {
        _initialHoldersRange.push(0);
        _initialHolders.push(initialInitialHolders);
        for (uint i = 0; i < initialInitialHolders.length; i++) {
            _initialHoldersMappings[0][initialInitialHolders[i]] = true;
        }
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Token Balances & Total Supply
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * @dev Implement: Return initial token balance for address.
     * This function MUST be pure: Always return the same values for a given input.
     */
    function initialBalanceOf(address account, uint tokenId)
        internal
        view
        virtual
        returns (uint);

    /**
     * @dev See {ERC1155-balanceOf}.
     */
    function balanceOf(address account, uint id)
        public
        view
        virtual
        override
        returns (uint)
    {
        require(
            account != address(0),
            "ERC1155: not a valid owner"
        );

        if (
            _inRange(id) &&
            !isBalanceInitialized[id][account] &&
            !isManualMint[id] &&
            isInitialHolderOf(account, id)
        ) {
            return initialBalanceOf(account, id);
        }

        return _balances[id][account];
    }

    /**
     * @dev Total amount of tokens of a given id.
     */
    function totalSupply(uint tokenId) public view virtual returns (uint) {
        // Pre initialization
        if (_inRange(tokenId) && !isManualMint[tokenId]) {
            uint initialTotalSupplySum = 0;
            address[] memory initialHolderAddresses = initialHolders(tokenId);
            for (uint i = 0; i < initialHolderAddresses.length; i++) {
                initialTotalSupplySum += initialBalanceOf(
                    initialHolderAddresses[i],
                    tokenId
                );
            }
            return
                uint(
                    int256(initialTotalSupplySum) + _totalSupplyDelta[tokenId]
                );
        }

        // manually minted
        return uint(_totalSupplyDelta[tokenId]);
    }

    /**
     * @dev See {ERC1155-_beforeTokenTransfer}.
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint[] memory ids,
        uint[] memory amounts,
        bytes memory data
    ) internal virtual override {
        // for each token transfered:
        for (uint i = 0; i < ids.length; ++i) {
            uint id = ids[i];

            // when minting
            if (from == address(0)) {
                // set isManualMint flag if id doesnt exist -> minted via _mint||_mintBatch
                if (!exists(id)) {
                    isManualMint[id] = true;
                    _manualMintsCount++;
                }
                // track supply
                _totalSupplyDelta[id] += int256(amounts[i]);
            }
            // track supply when burning
            if (to == address(0)) {
                _totalSupplyDelta[id] -= int256(amounts[i]);
            }
            // initialize balances if minted via _mintRange
            _maybeInitializeBalance(from, id);
            _maybeInitializeBalance(to, id);
        }
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    /**
     * @dev Writes dynamic initial Balance to state if uninitialized.
     */
    function _maybeInitializeBalance(address account, uint id) private {
        if (
            account != address(0) &&
            !isBalanceInitialized[id][account] &&
            !isManualMint[id] &&
            _inRange(id) &&
            isInitialHolderOf(account, id)
        ) {
            uint balance = initialBalanceOf(account, id);
            if (balance > 0) {
                isBalanceInitialized[id][account] = true;
                _balances[id][account] = balance;
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Intitial Holders
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * @dev Set initial holders. mintRange will distribute tokens to these holders
     */
    function _setInitialHolders(address[] memory addresses) internal virtual {
        uint256 firstId = isZeroMinted ? lastRangeTokenIdMinted + 1 : 0;
        uint256 lastIndex = _initialHolders.length-1;
        uint256 lastId = _initialHoldersRange[lastIndex];
        if (lastId == firstId) {
            address[] memory prevInitialHolders = _initialHolders[lastId];
            _initialHolders[lastId] = addresses;
            for (uint i = 0; i < prevInitialHolders.length; i++) {
                delete _initialHoldersMappings[lastIndex][
                    prevInitialHolders[i]
                ];
            }
        } else {
            _initialHoldersRange.push(firstId);
            _initialHolders.push(addresses);
            lastIndex = lastIndex+1;
        }
        for (uint i = 0; i < addresses.length; i++) {
            _initialHoldersMappings[lastIndex][addresses[i]] = true;
        }
    }

    /**
     * @dev Returns initial holders of a token.
     */
    function initialHolders(uint tokenId)
        public
        view
        virtual
        returns (address[] memory)
    {
        uint index = DateTime.findLowerBound(_initialHoldersRange, tokenId);
        return _initialHolders[index];
    }

    /**
     * @dev Returns true if address is an initial holder of tokenId
     */
    function isInitialHolderOf(address account, uint tokenId)
        public
        view
        returns (bool)
    {
        uint index = DateTime.findLowerBound(_initialHoldersRange, tokenId);
        return _initialHoldersMappings[index][account];
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Mint Range
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * @dev Implement: May be overwritten to add custom values to checksum test.
     */
    function _customMintRangeChecksum()
        internal
        view
        virtual
        returns (bytes32)
    {
        return 0x00;
    }

    /**
     * @dev Generate mintRange inputs for x new tokens.
     */
    function getMintRangeInput(uint numberOfTokens)
        public
        view
        returns (
            uint[] memory,
            uint[][] memory,
            bytes32
        )
    {
        uint firstId = isZeroMinted ? lastRangeTokenIdMinted + 1 : 0;
        address[] memory holders = initialHolders(firstId);
        uint[] memory ids = new uint[](numberOfTokens);
        uint[][] memory amounts = new uint[][](holders.length);

        uint newIndex = 0;
        for (uint i = 0; newIndex < numberOfTokens; i++) {
            uint newId = firstId + i;
            if (isManualMint[newId]) {
                continue;
            }
            ids[newIndex] = newId;
            for (uint b = 0; b < holders.length; b++) {
                if (newIndex == 0) {
                    amounts[b] = new uint[](numberOfTokens);
                }
                amounts[b][newIndex] = initialBalanceOf(holders[b], newId);
            }
            newIndex += 1;
        }
        bytes32 checksum = keccak256(
            abi.encode(
                ids,
                amounts,
                holders,
                lastRangeTokenIdMinted,
                isZeroMinted,
                _manualMintsCount,
                _customMintRangeChecksum()
            )
        );

        return (ids, amounts, checksum);
    }

    /**
     * @dev Lazy-mint a range of new tokenIds to initial holders
     */
    function _mintRange(
        uint[] memory ids,
        uint[][] memory amounts,
        bytes32 inputChecksum
    ) internal virtual {
        address[] memory addresses = initialHolders(ids[0]);

        bytes32 checksum = keccak256(
            abi.encode(
                ids,
                amounts,
                addresses,
                lastRangeTokenIdMinted,
                isZeroMinted,
                _manualMintsCount,
                _customMintRangeChecksum()
            )
        );
        require(inputChecksum == checksum, "Invalid input. Use getMintRangeInput()");

        lastRangeTokenIdMinted = ids[ids.length - 1];

        if (isZeroMinted == false) {
            isZeroMinted = true;
        }
        for (uint i = 0; i < addresses.length; i++) {
            emit TransferBatch(
                msg.sender,
                address(0),
                addresses[i],
                ids,
                amounts[i]
            );
        }
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Uitilities
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * @dev Returns true if tokenId was minted.
     */
    function exists(uint tokenId) public view virtual returns (bool) {
        return _inRange(tokenId) || isManualMint[tokenId] == true;
    }

    /**
     * @dev Returns true if token is in existing id range.
     */
    function _inRange(uint tokenId) private view returns (bool) {
        return isZeroMinted && tokenId <= lastRangeTokenIdMinted;
    }
}
