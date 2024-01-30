/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateMasterclassOneForm = /* GraphQL */ `
  subscription OnCreateMasterclassOneForm(
    $filter: ModelSubscriptionMasterclassOneFormFilterInput
  ) {
    onCreateMasterclassOneForm(filter: $filter) {
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
export const onUpdateMasterclassOneForm = /* GraphQL */ `
  subscription OnUpdateMasterclassOneForm(
    $filter: ModelSubscriptionMasterclassOneFormFilterInput
  ) {
    onUpdateMasterclassOneForm(filter: $filter) {
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
export const onDeleteMasterclassOneForm = /* GraphQL */ `
  subscription OnDeleteMasterclassOneForm(
    $filter: ModelSubscriptionMasterclassOneFormFilterInput
  ) {
    onDeleteMasterclassOneForm(filter: $filter) {
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
export const onCreateUser = /* GraphQL */ `
  subscription OnCreateUser(
    $filter: ModelSubscriptionUserFilterInput
    $owner: String
  ) {
    onCreateUser(filter: $filter, owner: $owner) {
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
export const onUpdateUser = /* GraphQL */ `
  subscription OnUpdateUser(
    $filter: ModelSubscriptionUserFilterInput
    $owner: String
  ) {
    onUpdateUser(filter: $filter, owner: $owner) {
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
export const onDeleteUser = /* GraphQL */ `
  subscription OnDeleteUser(
    $filter: ModelSubscriptionUserFilterInput
    $owner: String
  ) {
    onDeleteUser(filter: $filter, owner: $owner) {
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
