// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC1155/extensions/ERC1155Supply.sol)

pragma solidity ^0.8.0;

import "./ERC1155_.sol";
import "hardhat/console.sol";

/**
 * @dev Extension of ERC1155 enables mintRange with dynamic initial balance
 * and adds tracking of total supply per id.
 */
abstract contract ERC1155DynamicInitialBalances is ERC1155_ {
    string private constant ERROR_INVALID_INPUT_MINT_RANGE =
        "Invalid input. Use getMintRangeInput()";
    string private constant ERROR_NO_INITIAL_HOLDERS =
        "No initial holders set. Use _setInitialHolders()";

    // Mapping from token ID to balancesInitialzed flag
    mapping(uint256 => mapping(address => bool)) private _balancesInitialized;

    // Mapping to keep track of tokens that are minted via ERC1155._mint() or  ERC1155._mintBatch()
    mapping(uint256 => bool) private _manualMint;

    // Mapping from token ID to totalSupply
    mapping(uint256 => int256) private _totalSupply;

    // Track initial holders across tokenID ranges;
    address[][] private _initialHolders;
    uint256[] private _initialHoldersRange;

    uint256 public _lastRangeTokenId = 0;
    bool private _zeroMinted = false;

    /**
     * @dev Implement: Return initial token balance for address.
     * This function MUST be pure: Always return the same values for a given input.
     */
    function initialBalanceOf(address account, uint256 tokenId)
        public
        view
        virtual
        returns (uint256);

    /**
     * @dev Set initial holders. mintRange will distribute tokens to these holders
     */
    function _setInitialHolders(address[] memory addresses) internal virtual {
        _initialHoldersRange.push(_zeroMinted ? _lastRangeTokenId + 1 : 0);
        _initialHolders.push(addresses);
    }

    /**
     * @dev Lazy-mint a range of new tokenIds to initial holders
     */
    function _safeMintRange(
        address[] memory addresses,
        uint256[] memory ids,
        uint256[][] memory amounts
    ) internal virtual {
        for (uint i = 0; i < ids.length; i++) {
            require(
                !exists(ids[i]),
                "Error: Range can't include an existing tokenId!"
            );
        }
        _mintRange(addresses, ids, amounts);
    }

    /**
     * @dev Lazy-mint a range of new tokenIds to initial holders
     */
    function _mintRange(
        address[] memory addresses,
        uint256[] memory ids,
        uint256[][] memory amounts
    ) internal virtual {
        _lastRangeTokenId = ids[ids.length - 1];

        if (_zeroMinted == false) {
            _zeroMinted = true;
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

    /**
     * @dev Returns true if tokenId was minted.
     */
    function exists(uint256 tokenId) public view virtual returns (bool) {
        return _inRange(tokenId) || _manualMint[tokenId] == true;
    }

    /**
     * @dev See {ERC1155-balanceOf}.
     */
    function balanceOf(address account, uint256 id)
        public
        view
        virtual
        override
        returns (uint256)
    {
        require(
            account != address(0),
            "ERC1155: address zero is not a valid owner"
        );

        // Pre initialization
        if (
            _inRange(id) &&
            !_balancesInitialized[id][account] &&
            !_manualMint[id]
        ) {
            address[] memory addresses = initialHolders(id);
            for (uint i = 0; i < addresses.length; i++) {
                if (account == addresses[i]) {
                    return initialBalanceOf(account, id);
                }
            }
        }

        // Post initialization
        return _balances[id][account];
    }

    /**
     * @dev Returns initial holders of a token.
     */
    function initialHolders(uint256 tokenId)
        public
        view
        virtual
        returns (address[] memory)
    {
        require(_initialHolders.length > 0, ERROR_NO_INITIAL_HOLDERS);
        uint index = _findInRange(_initialHoldersRange, tokenId);
        return _initialHolders[index];
    }

    /**
     * @dev Return current initial holders
     */
    function initialHolders() public view virtual returns (address[] memory) {
        require(_initialHolders.length > 0, ERROR_NO_INITIAL_HOLDERS);
        return _initialHolders[_initialHolders.length - 1];
    }

    /**
     * @dev Total amount of tokens with a given id.
     */
    function totalSupply(uint256 tokenId)
        public
        view
        virtual
        returns (uint256)
    {
        // Pre initialization
        if (_inRange(tokenId) && !_manualMint[tokenId]) {
            uint256 totalSupplySum = 0;
            address[] memory initialHolderAddresses = initialHolders(tokenId);
            for (uint i = 0; i < initialHolderAddresses.length; i++) {
                totalSupplySum += initialBalanceOf(
                    initialHolderAddresses[i],
                    tokenId
                );
            }
            return uint256(int256(totalSupplySum) + _totalSupply[tokenId]);
        }

        // manually minted
        return uint256(_totalSupply[tokenId]);
    }

    /**
     * @dev Convenience method to generate mintRange inputs for x new tokens.
     */
    function getMintRangeInput(uint256 numberOfTokens)
        public
        view
        returns (
            address[] memory,
            uint256[] memory,
            uint256[][] memory
        )
    {
        uint256 firstId = _zeroMinted ? _lastRangeTokenId + 1 : 0;
        address[] memory addresses = initialHolders(firstId);
        uint256[] memory ids = new uint256[](numberOfTokens);
        uint256[][] memory amounts = new uint256[][](addresses.length);

        uint256 newIndex = 0;
        for (uint256 i = 0; newIndex < numberOfTokens; i++) {
            uint256 newId = firstId + i;
            if (_manualMint[newId]) {
                continue;
            }
            ids[newIndex] = newId;
            for (uint256 b = 0; b < addresses.length; b++) {
                if (newIndex == 0) {
                    amounts[b] = new uint256[](numberOfTokens);
                }
                amounts[b][newIndex] = initialBalanceOf(addresses[b], newId);
            }
            newIndex += 1;
        }

        return (addresses, ids, amounts);
    }

    /**
     * @dev See {ERC1155-_beforeTokenTransfer}.
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];

            // when minting
            if (from == address(0)) {
                // set _manualMint flag if minted via _mint||_mintBatch
                if (!exists(id)) {
                    _manualMint[id] = true;
                }
                // track supply
                _totalSupply[id] += int256(amounts[i]);
            }
            // track supply when burning
            if (to == address(0)) {
                _totalSupply[id] -= int256(amounts[i]);
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
    function _maybeInitializeBalance(address account, uint256 id) private {
        // Pre initialization
        if (
            _inRange(id) &&
            !_balancesInitialized[id][account] &&
            !_manualMint[id]
        ) {
            _balancesInitialized[id][account] = true;
            address[] memory addresses = initialHolders(id);
            for (uint i = 0; i < addresses.length; i++) {
                if (account == addresses[i]) {
                    _balances[id][account] = initialBalanceOf(account, id);
                    return;
                }
            }
        }
        // Post initialization
        // no-op
    }

    /**
     * @dev Returns true if token is in existing id range.
     */
    function _inRange(uint256 tokenId) private view returns (bool) {
        return _zeroMinted && tokenId <= _lastRangeTokenId;
    }

    /**
     * @dev Utility find range/bucket for tokenId.
     */
    function _findInRange(uint256[] memory range, uint256 tokenId)
        internal
        pure
        returns (uint256)
    {
        for (uint256 i = range.length - 1; i >= 0; i--) {
            if (tokenId >= range[i]) {
                return i;
            }
        }
        return 0;
    }
}
