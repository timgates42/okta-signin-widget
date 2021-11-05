/*!
 * Copyright (c) 2021, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import Errors from 'util/Errors';
import Logger from 'util/Logger';
import Enums from 'util/Enums';
import { startLoginFlow } from './startLoginFlow';
import sessionStorageHelper from './sessionStorageHelper';
import {
  getTransactionMeta,
  saveTransactionMeta,
  clearTransactionMeta,
} from './transactionMeta';

async function proceedIfAvailable(idxResponse, remediation) {
  console.log(idxResponse);
  const rem = idxResponse.neededToProceed.find(item => item.name === remediation);
  if (rem) {
      return await idxResponse.proceed(remediation);
  }
  return idxResponse;
};

async function stepIntoSpecificIdxFlow(idxResponse, flow='') {
  console.log('stepIntoSpecificIdxFlow called');
  try {
    if (flow === Enums.LOGIN_FLOW) {
      // default IDX response from interact is "Login" page/flow. Do nothing
      return idxResponse;
    }

    if (flow === Enums.REGISTRATION_FLOW) {
      return await proceedIfAvailable(idxResponse, 'select-enroll-profile');
    }

    if (flow === Enums.RESET_PASSWORD_FLOW) {
      return idxResponse.actions['currentAuthenticator-recover'] ?
        await idxResponse.actions['currentAuthenticator-recover']() : idxResponse;
    }

    if (flow === Enums.UNLOCK_ACCOUNT_FLOW) {
      // requires: introspect -> identify-recovery -> select-authenticator-unlock-account
      return await proceedIfAvailable(idxResponse,'identify-recovery');
    }

    Logger.warn(`Unknown \`flow\` value: ${flow}`);
    return idxResponse;
  }
  catch (err) {
    console.log('stepIntoSpecificIdxFlow Error caught')
    // catches and handles `Unknown remediation` errors thrown okta-idx-js
    if (typeof err === 'string' && err.startsWith('Unknown remediation choice')) {
      Logger.warn(`initialFlow [${flow}] not valid with current Org configurations`);
      // throw new Errors.InitialFlowError('Unable to proceed to desired flow', flow);
      return idxResponse;
    }
    else {
      // do not catch non-`Unknown remediation` errors here
      throw err;
    }
  }
}
  
export async function startSpecificFlow(originalResp, settings) {
  let idxResponse = originalResp;

  const meta = await getTransactionMeta(settings);
  const configuredFlow = settings.get('initialFlow');
  console.log(meta.flowId, configuredFlow)
  
  if (meta.flowId !== configuredFlow || !configuredFlow) {
    // configured flow and active flow do not match, abandon active flow, start new (configured) flow
    Logger.warn(`Cancelling current '${meta.flowId}' flow to start '${configuredFlow}' flow`);
    sessionStorageHelper.removeStateHandle();
    clearTransactionMeta(settings);
    idxResponse = await startLoginFlow(settings);
  }

  if (configuredFlow) {
    idxResponse = await stepIntoSpecificIdxFlow(idxResponse, configuredFlow);
    const newMeta = Object.assign({}, {...meta}, {flowId: configuredFlow});
    saveTransactionMeta(settings, newMeta);

    return idxResponse;
  }

  return idxResponse;
}
  