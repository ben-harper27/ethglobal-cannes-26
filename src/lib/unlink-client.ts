import {
  createUnlinkClient,
  getEnvironment,
  deposit,
  transfer,
  deriveAccountKeys,
  buildPermit2TypedData,
  getPermit2Nonce,
} from "@unlink-xyz/sdk"

const ENGINE_URL = "https://staging-api.unlink.xyz"

export function getApiClient() {
  return createUnlinkClient(ENGINE_URL, process.env.UNLINK_API_KEY!)
}

export {
  getEnvironment,
  deposit,
  transfer,
  deriveAccountKeys,
  buildPermit2TypedData,
  getPermit2Nonce,
}
