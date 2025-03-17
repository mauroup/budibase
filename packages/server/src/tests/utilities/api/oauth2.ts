import {
  UpsertOAuth2ConfigRequest,
  UpsertOAuth2ConfigResponse,
  FetchOAuth2ConfigsResponse,
} from "@budibase/types"
import { Expectations, TestAPI } from "./base"

export class OAuth2API extends TestAPI {
  fetch = async (expectations?: Expectations) => {
    return await this._get<FetchOAuth2ConfigsResponse>("/api/oauth2", {
      expectations,
    })
  }

  create = async (
    body: UpsertOAuth2ConfigRequest,
    expectations?: Expectations
  ) => {
    return await this._post<UpsertOAuth2ConfigResponse>("/api/oauth2", {
      body,
      expectations: {
        status: expectations?.status ?? 201,
        ...expectations,
      },
    })
  }
}
