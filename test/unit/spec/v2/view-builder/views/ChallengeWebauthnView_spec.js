import ChallengeWebauthnView from 'v2/view-builder/views/webauthn/ChallengeWebauthnView';
import { BaseForm } from 'v2/view-builder/internals';
import AppState from 'v2/models/AppState';
import Settings from 'models/Settings';
import webauthn from 'util/webauthn';
import BrowserFeatures from 'util/BrowserFeatures';
import CryptoUtil from 'util/CryptoUtil';
import $sandbox from 'sandbox';
import Expect from 'helpers/util/Expect';
import ChallengeWebauthnResponse
  from '../../../../../../playground/mocks/data/idp/idx/authenticator-verification-webauthn.json';

describe('v2/view-builder/views/webauthn/ChallengeWebauthnView', function () {
  let test;
  beforeEach(function () {
    test = {};
    test.init = (
      currentAuthenticatorEnrollment = ChallengeWebauthnResponse.currentAuthenticatorEnrollment.value,
      authenticatorEnrollments = []
    ) => {
      const appState = new AppState({
        currentAuthenticatorEnrollment,
        authenticatorEnrollments,
      });
      spyOn(appState, 'hasRemediationObject').and.callFake(
        formName => formName === 'select-authenticator-authenticate'
      );
      spyOn(appState, 'shouldShowSignOutLinkInCurrentForm').and.returnValue(false);
      const settings = new Settings({ baseUrl: 'http://localhost:3000' });
      const currentViewState = {
        name: 'challenge-authenticator',
        relatesTo: {
          value: currentAuthenticatorEnrollment,
        },
      };
      test.view = new ChallengeWebauthnView({
        el: $sandbox,
        appState,
        settings,
        currentViewState,
      });
      test.view.render();
    };
  });

  afterEach(function () {
    $sandbox.empty();
  });

  it('shows verify instructions and spinner when webauthn is supported and browser is not safari', function () {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    spyOn(BrowserFeatures, 'isSafari').and.callFake(() => false);
    test.init();
    expect(test.view.$('.idx-webauthn-verify-text').text()).toBe(
      'You will be prompted to use a security key or biometric verification (Windows Hello, Touch ID, etc.). Follow the instructions to complete verification.'
    );
    expect(test.view.$('.retry-webauthn').css('display')).toBe('none');
    expect(test.view.$('.okta-waiting-spinner').css('display')).toBe('block');
    expect(test.view.$('.webauthn-not-supported').length).toBe(0);

  });

  it('shows verify instructions and button when browser supports webauthn on safari', function () {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    spyOn(BrowserFeatures, 'isSafari').and.callFake(() => true);
    test.init();
    expect(test.view.$('.idx-webauthn-verify-text').text()).toBe(
      'You will be prompted to use a security key or biometric verification (Windows Hello, Touch ID, etc.). Follow the instructions to complete verification.'
    );
    expect(test.view.$('.retry-webauthn').css('display')).not.toBe('none'); 
    expect(test.view.$('.retry-webauthn').text()).toBe('Verify');
    expect(test.view.$('.webauthn-not-supported').length).toBe(0);
  });

  it('updated button text to "Retry" on click on safari', function () {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    spyOn(BrowserFeatures, 'isSafari').and.callFake(() => true);
    test.init();
    expect(test.view.$('.idx-webauthn-verify-text').text()).toBe(
      'You will be prompted to use a security key or biometric verification (Windows Hello, Touch ID, etc.). Follow the instructions to complete verification.'
    );
    expect(test.view.$('.retry-webauthn').css('display')).not.toBe('none'); // default value: empty string in jest, 'inline' in browser
    expect(test.view.$('.retry-webauthn').text()).toBe('Verify');
    test.view.$('.retry-webauthn').click();
    expect(test.view.$('.retry-webauthn').css('display')).toBe('none');
    expect(test.view.$('.retry-webauthn').text()).toBe('Retry');
  });

  it('shows verify instructions if there are existing enrollments', function () {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    spyOn(BrowserFeatures, 'isSafari').and.callFake(() => true);
    test.init(
      ChallengeWebauthnResponse.currentAuthenticatorEnrollment.value,
      ChallengeWebauthnResponse.authenticatorEnrollments
    );
    expect(test.view.$('.idx-webauthn-verify-text').text()).toBe(
      'You will be prompted to use a security key or biometric verification (Windows Hello, Touch ID, etc.). Follow the instructions to complete verification.'
    );
    expect(test.view.$('.retry-webauthn').css('display')).not.toBe('none'); // default value: empty string in jest, 'inline' in browser
    expect(test.view.$('.retry-webauthn').text()).toBe('Verify');
    expect(test.view.$('.webauthn-not-supported').length).toBe(0);
  });

  it('shows error when browser does not support webauthn', function () {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => false);
    test.init();
    expect(test.view.$('.idx-webauthn-verify-text').length).toBe(0);
    expect(test.view.$('.retry-webauthn').length).toBe(0);
    expect(test.view.$('.okta-waiting-spinner').length).toBe(0);
    expect(test.view.$('.webauthn-not-supported').length).toBe(1);
    expect(test.view.$('.webauthn-not-supported').text().trim()).toBe(
      'Security key or biometric authenticator is not supported on this browser. Contact your admin for assistance.'
    );
  });

  it('shows UV required callout when userVerification is "required"', function () {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    const currentAuthenticatorEnrollment = JSON.parse(
      JSON.stringify(ChallengeWebauthnResponse.currentAuthenticatorEnrollment.value)
    );
    currentAuthenticatorEnrollment.contextualData.challengeData.userVerification = 'required';
    test.init(currentAuthenticatorEnrollment);
    expect(test.view.$('.uv-required-callout').length).toBe(1);
    expect(test.view.$('.uv-required-callout').text().trim()).toBe(
      'Biometric verification or a PIN is required to sign in with this authenticator.'
    );
  });

  it('does not show UV required callout when userVerification is "discouraged"', function () {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    const currentAuthenticatorEnrollment = JSON.parse(
      JSON.stringify(ChallengeWebauthnResponse.currentAuthenticatorEnrollment.value)
    );
    currentAuthenticatorEnrollment.contextualData.challengeData.userVerification = 'discouraged';
    test.init(currentAuthenticatorEnrollment);
    expect(test.view.$('.uv-required-callout').length).toBe(0);
  });

  it('saveForm is called with model when credentials.get succeeds', function (done) {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    const assertion = {
      response: {
        clientDataJSON: 123,
        authenticatorData: 234,
        signature: 'magizh',
      },
    };
    spyOn(BaseForm.prototype, 'saveForm');
    spyOn(navigator.credentials, 'get').and.returnValue(Promise.resolve(assertion));

    test.init(
      ChallengeWebauthnResponse.currentAuthenticatorEnrollment.value,
      ChallengeWebauthnResponse.authenticatorEnrollments
    );
    Expect.waitForSpyCall(test.view.form.saveForm)
      .then(() => {
        expect(navigator.credentials.get).toHaveBeenCalledWith({
          publicKey: {
            allowCredentials: [
              {
                type: 'public-key',
                id: CryptoUtil.strToBin(
                  'hpxQXbu5R5Y2JMqpvtE9Oo9FdwO6z2kMR-ZQkAb6p6GSguXQ57oVXKvpVHT2fyCR_m2EL1vIgszxi00kyFIX6w'
                ),
              },
              {
                type: 'public-key',
                id: CryptoUtil.strToBin(
                  '7Ag2iWUqfz0SanWDj-ZZ2fpDsgiEDt_08O1VSSRZHpgkUS1zhLSyWYDrxXXB5VE_w1iiqSvPaRgXcmG5rPwB-w'
                ),
              },
            ],
            userVerification: 'required',
            challenge: CryptoUtil.strToBin(
              ChallengeWebauthnResponse.currentAuthenticatorEnrollment.value.contextualData.challengeData.challenge
            ),
          },
          signal: jasmine.any(Object),
        });
        expect(test.view.form.model.get('credentials')).toEqual({
          clientData: CryptoUtil.binToStr(assertion.response.clientDataJSON),
          authenticatorData: CryptoUtil.binToStr(assertion.response.authenticatorData),
          signatureData: CryptoUtil.binToStr(assertion.response.signature),
        });
        expect(test.view.form.saveForm).toHaveBeenCalledWith(test.view.form.model);
        expect(test.view.form.webauthnAbortController).toBe(null);
        done();
      })
      .catch(done.fail);
  });

  it('error is displayed when credentials.get fails', function (done) {
    spyOn(webauthn, 'isNewApiAvailable').and.callFake(() => true);
    spyOn(navigator.credentials, 'get').and.returnValue(Promise.reject({ message: 'error from browser' }));
    test.init();
    Expect.waitForCss('.infobox-error')
      .then(() => {
        expect(test.view.$el.find('.infobox-error')[0].textContent.trim()).toBe('error from browser');
        expect(test.view.form.webauthnAbortController).toBe(null);
        done();
      })
      .catch(done.fail);
  });
});
