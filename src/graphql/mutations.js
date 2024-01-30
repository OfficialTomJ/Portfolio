/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createMasterclassOneForm = /* GraphQL */ `
  mutation CreateMasterclassOneForm(
    $input: CreateMasterclassOneFormInput!
    $condition: ModelMasterclassOneFormConditionInput
  ) {
    createMasterclassOneForm(input: $input, condition: $condition) {
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
export const updateMasterclassOneForm = /* GraphQL */ `
  mutation UpdateMasterclassOneForm(
    $input: UpdateMasterclassOneFormInput!
    $condition: ModelMasterclassOneFormConditionInput
  ) {
    updateMasterclassOneForm(input: $input, condition: $condition) {
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
export const deleteMasterclassOneForm = /* GraphQL */ `
  mutation DeleteMasterclassOneForm(
    $input: DeleteMasterclassOneFormInput!
    $condition: ModelMasterclassOneFormConditionInput
  ) {
    deleteMasterclassOneForm(input: $input, condition: $condition) {
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
export const createUser = /* GraphQL */ `
  mutation CreateUser(
    $input: CreateUserInput!
    $condition: ModelUserConditionInput
  ) {
    createUser(input: $input, condition: $condition) {
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
export const updateUser = /* GraphQL */ `
  mutation UpdateUser(
    $input: UpdateUserInput!
    $condition: ModelUserConditionInput
  ) {
    updateUser(input: $input, condition: $condition) {
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
export const deleteUser = /* GraphQL */ `
  mutation DeleteUser(
    $input: DeleteUserInput!
    $condition: ModelUserConditionInput
  ) {
    deleteUser(input: $input, condition: $condition) {
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
