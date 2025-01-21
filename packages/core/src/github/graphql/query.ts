import { print } from "graphql";

import { graphql } from "./graphql";

export function getQueryGithubIssuesWithMetadata() {
  // use explorer to test GraphQL queries: https://docs.github.com/en/graphql/overview/explorer
  const query = graphql(`
    query paginate(
      $cursor: String
      $organization: String!
      $repo: String!
      $since: DateTime
      $first: Int!
    ) {
      repository(owner: $organization, name: $repo) {
        issues(
          first: $first
          after: $cursor
          orderBy: { field: UPDATED_AT, direction: ASC }
          filterBy: { since: $since }
        ) {
          nodes {
            id
            number
            title
            body
            url
            state
            stateReason
            createdAt
            updatedAt
            closedAt
            author {
              login
              avatarUrl
              url
            }
            labels(first: 10) {
              nodes {
                id
                name
                color
                description
              }
            }
            reactionGroups {
              content
              reactors {
                totalCount
              }
            }
            comments(
              first: 100
              orderBy: { field: UPDATED_AT, direction: ASC }
            ) {
              nodes {
                id
                author {
                  login
                  avatarUrl
                  url
                }
                body
                createdAt
                updatedAt
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `);
  return print(query);
}

export function getQueryIssueNumbers() {
  const query = graphql(`
    query getIssueNumbers(
      $cursor: String
      $organization: String!
      $repo: String!
      $since: DateTime
      $first: Int!
    ) {
      repository(owner: $organization, name: $repo) {
        issues(
          first: $first
          after: $cursor
          orderBy: { field: UPDATED_AT, direction: ASC }
          filterBy: { since: $since }
        ) {
          nodes {
            number
            updatedAt
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `);
  return print(query);
}
