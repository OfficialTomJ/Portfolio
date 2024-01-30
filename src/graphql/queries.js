/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getMasterclassOneForm = /* GraphQL */ `
  query GetMasterclassOneForm($id: ID!) {
    getMasterclassOneForm(id: $id) {
      id
      full_name
      email
      trading_experience
      trading_skill
      description
      additional
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listMasterclassOneForms = /* GraphQL */ `
  query ListMasterclassOneForms(
    $filter: ModelMasterclassOneFormFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listMasterclassOneForms(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        full_name
        email
        trading_experience
        trading_skill
        description
        additional
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getUser = /* GraphQL */ `
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id
      discordID
      discordUsername
      discordGlobalName
      discordAvatar
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const listUsers = /* GraphQL */ `
  query ListUsers(
    $filter: ModelUserFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listUsers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        discordID
        discordUsername
        discordGlobalName
        discordAvatar
        createdAt
        updatedAt
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
