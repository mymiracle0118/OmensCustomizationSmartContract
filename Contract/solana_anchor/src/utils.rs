use {
    crate::PoolError,
    crate::Pool,
    anchor_lang::{
        prelude::{AccountInfo, ProgramResult, ProgramAccount},
        Key,
        ToAccountInfo,
        solana_program::{
            program::{invoke_signed, invoke},
        },
    },
};

pub struct TokenTransferParams<'a: 'b, 'b> {
    /// source
    pub source: AccountInfo<'a>,
    /// destination
    pub destination: AccountInfo<'a>,
    /// amount
    pub amount: u64,
    /// authority
    pub authority: AccountInfo<'a>,
    /// authority_signer_seeds
    pub authority_signer_seeds: &'b [&'b [u8]],
    /// token_program
    pub token_program: AccountInfo<'a>,
}


#[inline(always)]
pub fn spl_token_transfer(params: TokenTransferParams<'_, '_>) -> ProgramResult {
    let TokenTransferParams {
        source,
        destination,
        authority,
        token_program,
        amount,
        authority_signer_seeds,
    } = params;

    let result = invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            source.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?,
        &[source, destination, authority, token_program],
        &[authority_signer_seeds],
    );

    result.map_err(|_| PoolError::TokenTransferFailed.into())
}

pub struct TokenTransferParamsWithoutSeed<'a> {
    /// source
    pub source: AccountInfo<'a>,
    /// destination
    pub destination: AccountInfo<'a>,
    /// amount
    pub amount: u64,
    /// authority
    pub authority: AccountInfo<'a>,
    /// token_program
    pub token_program: AccountInfo<'a>,
}

pub fn spl_token_transfer_without_seed(params: TokenTransferParamsWithoutSeed<'_>) -> ProgramResult {
    let TokenTransferParamsWithoutSeed {
        source,
        destination,
        authority,
        token_program,
        amount,
    } = params;

    let result = invoke(
        &spl_token::instruction::transfer(
            token_program.key,
            source.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?,
        &[source, destination ,authority, token_program],
    );

    result.map_err(|_| PoolError::TokenTransferFailed.into())
}

pub struct TokenSetAuthorityParams<'a>{
    pub authority : AccountInfo<'a>,
    pub new_authority : AccountInfo<'a>,
    pub account : AccountInfo<'a>,
    pub token_program : AccountInfo<'a>,
}

#[inline(always)]
pub fn spl_token_set_authority(params : TokenSetAuthorityParams<'_>) -> ProgramResult {
    let TokenSetAuthorityParams {
        authority,
        new_authority,
        account,
        token_program,
    } = params;

    let result = invoke(
        &spl_token::instruction::set_authority(
            token_program.key,
            account.key,
            Some(new_authority.key),
            spl_token::instruction::AuthorityType::MintTokens,
            authority.key,
            &[],
        )?,
        &[authority,new_authority,account,token_program],
    );
    result.map_err(|_| PoolError::TokenSetAuthorityFailed.into())
}

pub struct TokenMintToParams<'a: 'b, 'b> {
    pub mint: AccountInfo<'a>,
    pub destination: AccountInfo<'a>,
    pub amount: u64,
    pub authority: AccountInfo<'a>,
    pub authority_signer_seeds: &'b [&'b [u8]],
    pub token_program: AccountInfo<'a>,
}

pub fn spl_token_mint_to(params: TokenMintToParams<'_, '_>) -> ProgramResult {
    let TokenMintToParams {
        mint,
        destination,
        authority,
        token_program,
        amount,
        authority_signer_seeds,
    } = params;
    let result = invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            mint.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?,
        &[mint, destination, authority, token_program],
        &[authority_signer_seeds],
    );
    result.map_err(|_| PoolError::TokenMintToFailed.into())
}

pub struct SolTransferToPoolParams<'a> {
    /// source
    pub source: AccountInfo<'a>,
    /// destination
    pub destination: ProgramAccount<'a, Pool>,
    /// amount
    pub amount: u64,
}

pub fn sol_transfer_to_pool(params: SolTransferToPoolParams<'_>) -> ProgramResult {
    let SolTransferToPoolParams {
        source,
        destination,
        amount
    } = params;

    let result = invoke(
        &anchor_lang::solana_program::system_instruction::transfer(
            source.key,
            &destination.key(),
            amount,
        ),
        &[source, destination.to_account_info()],
    );

    result.map_err(|_| PoolError::SolTransferFailed.into())
}