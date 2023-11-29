// queries.js

export const listUsers = /* GraphQL */ `
  query ListUsers {
    listUsers {
      items {
        id
        discordID
        discordUsername
        discordGlobalName
        discordAvatar
      }
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
    }
  }
`;

export const deleteDiscord = /* GraphQL */ `
  mutation DeleteUser($id: ID!) {
    deleteUser(input: { id: $id }) {
      id
    }
  }
`;
export const createUser = /* GraphQL */ `
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      discordID
      discordUsername
      discordGlobalName
      discordAvatar
    }
  }
`;