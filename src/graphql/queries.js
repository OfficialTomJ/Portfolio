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

// Add other queries or mutations related to the User type as needed
