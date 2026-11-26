// Cloudflare Pages <-> GAS Web API 橋接器
(function () {
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    return; // 若仍在 GAS 環境內開啟，維持原生 google.script.run
  }

  function getApiUrl() {
    return (window.APP_CONFIG && window.APP_CONFIG.GAS_API_URL) || '';
  }

  function createRunner(onSuccess, onFailure) {
    return new Proxy({}, {
      get: function (_target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (fn) { return createRunner(fn, onFailure); };
        }
        if (prop === 'withFailureHandler') {
          return function (fn) { return createRunner(onSuccess, fn); };
        }
        return function () {
          var apiUrl = getApiUrl();
          if (!apiUrl || apiUrl.indexOf('請貼上') !== -1) {
            var cfgErr = new Error('尚未於 config.js 設定正確的 GAS_API_URL');
            if (onFailure) onFailure(cfgErr);
            return;
          }
          var args = Array.prototype.slice.call(arguments);
          fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              webApi: true,
              fn: String(prop),
              args: args
            })
          })
            .then(function (res) {
              if (!res.ok) throw new Error('伺服器連線異常（HTTP ' + res.status + '）');
              return res.json();
            })
            .then(function (data) {
              if (data && data.__gasError) {
                if (onFailure) onFailure(new Error(data.__gasError));
              } else if (onSuccess) {
                onSuccess(data);
              }
            })
            .catch(function (err) {
              if (onFailure) onFailure(err);
            });
        };
      }
    });
  }

  window.google = {
    script: {
      run: createRunner(null, null)
    }
  };
})();
