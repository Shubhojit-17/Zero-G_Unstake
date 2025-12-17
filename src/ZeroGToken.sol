// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";

/**
 * @title ZeroGToken
 * @author Zero-G Unstake Team
 * @notice A standard ERC20 token deployed on BSC Testnet for demonstration
 * @dev This is a real, deployed token - not a mock. It represents the type of
 *      staking reward token that users would typically stake in DeFi protocols.
 *      
 *      For the hackathon demo:
 *      - Deployer receives initial supply
 *      - Tokens can be distributed to test users
 *      - Users stake these tokens in StakingVault
 *      - Relayer fee is paid in these tokens
 */
contract ZeroGToken is IERC20 {
    // ============ Errors ============
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    // ============ State Variables ============
    string public constant override name = "Zero-G Token";
    string public constant override symbol = "ZGT";
    uint8 public constant override decimals = 18;
    
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    // ============ Constructor ============

    /**
     * @notice Deploy the ZeroG Token
     * @param initialSupply The initial token supply (in wei)
     * @param recipient The address to receive the initial supply
     */
    constructor(uint256 initialSupply, address recipient) {
        if (recipient == address(0)) revert ZeroAddress();
        totalSupply = initialSupply;
        balanceOf[recipient] = initialSupply;
        emit Transfer(address(0), recipient, initialSupply);
    }

    // ============ External Functions ============

    /**
     * @notice Transfer tokens to a recipient
     * @param to The recipient address
     * @param amount The amount to transfer
     * @return success True if transfer succeeded
     */
    function transfer(address to, uint256 amount) external override returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @notice Approve a spender to transfer tokens
     * @param spender The spender address
     * @param amount The amount to approve
     * @return success True if approval succeeded
     */
    function approve(address spender, uint256 amount) external override returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Transfer tokens from one address to another
     * @param from The sender address
     * @param to The recipient address
     * @param amount The amount to transfer
     * @return success True if transfer succeeded
     */
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        if (allowance[from][msg.sender] < amount) revert InsufficientAllowance();

        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }
}
