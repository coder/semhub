/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SearchImport } from './routes/search'
import { Route as IndexImport } from './routes/index'
import { Route as ReposIndexImport } from './routes/repos/index'
import { Route as ReposSearchImport } from './routes/repos/search'

// Create/Update Routes

const SearchRoute = SearchImport.update({
  path: '/search',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const ReposIndexRoute = ReposIndexImport.update({
  path: '/repos/',
  getParentRoute: () => rootRoute,
} as any)

const ReposSearchRoute = ReposSearchImport.update({
  path: '/repos/search',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/search': {
      id: '/search'
      path: '/search'
      fullPath: '/search'
      preLoaderRoute: typeof SearchImport
      parentRoute: typeof rootRoute
    }
    '/repos/search': {
      id: '/repos/search'
      path: '/repos/search'
      fullPath: '/repos/search'
      preLoaderRoute: typeof ReposSearchImport
      parentRoute: typeof rootRoute
    }
    '/repos/': {
      id: '/repos/'
      path: '/repos'
      fullPath: '/repos'
      preLoaderRoute: typeof ReposIndexImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/search': typeof SearchRoute
  '/repos/search': typeof ReposSearchRoute
  '/repos': typeof ReposIndexRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/search': typeof SearchRoute
  '/repos/search': typeof ReposSearchRoute
  '/repos': typeof ReposIndexRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/search': typeof SearchRoute
  '/repos/search': typeof ReposSearchRoute
  '/repos/': typeof ReposIndexRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/search' | '/repos/search' | '/repos'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/search' | '/repos/search' | '/repos'
  id: '__root__' | '/' | '/search' | '/repos/search' | '/repos/'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  SearchRoute: typeof SearchRoute
  ReposSearchRoute: typeof ReposSearchRoute
  ReposIndexRoute: typeof ReposIndexRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  SearchRoute: SearchRoute,
  ReposSearchRoute: ReposSearchRoute,
  ReposIndexRoute: ReposIndexRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* prettier-ignore-end */

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/search",
        "/repos/search",
        "/repos/"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/search": {
      "filePath": "search.tsx"
    },
    "/repos/search": {
      "filePath": "repos/search.tsx"
    },
    "/repos/": {
      "filePath": "repos/index.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
