/**
 * Copyright Composiv Inc and its affiliates
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 *
 * RemoteComponent
 *
 */

import React, { useState, useEffect } from 'react';
import { Platform, Button } from 'react-native';

import {
  Registry,
  ViewBuilder,
  config as liveuiConfig,
} from '@eclipse-muto/liveui-core';
import PropTypes from 'prop-types';

export const ComponentStatus = {
  loading: 'loading',
  success: 'success',
  error: 'error',
  cancelled: 'cancelled',
};

const Status = ({ status, form, action }: any) => {
  return (
    <Button
      onPress={() => {
        action && action();
      }}
      title={`${form?.component} status: ${status} error: ${status}`}
    />
  );
};

const RemoteComponent = (props: any) => {
  const {
    url,
    name,
    source,
    form,
    onError,
    placeholder,
    lruCache,
    ...compProps
  } = props;
  const [exports, setExports] = useState<any>();
  const [status, setStatus] = useState(ComponentStatus.loading);
  const [error, setError] = useState({ message: '' });

  useEffect(() => {
    fetchComponent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, form, name]);

  const fetchComponent = () => {
    setStatus(ComponentStatus.loading);
    const key = form?.from || name;
    if (url) {
      handleRequest(url);
    } else if (key) {
      const componentUrl = Registry.getComponentUrl(key);
      handleRequest(componentUrl);
    } else if (source) {
      const _exports = ViewBuilder.build(source, onError);
      setExports(_exports);
    }
  };

  function handleRequest(componentUrl: any) {
    const _cached = lruCache && lruCache.get(componentUrl);
    if (_cached) {
      setExports(_cached);
      setStatus(ComponentStatus.success);
      return;
    }

    let fetchtUrl = componentUrl;
    // TODO move this snippet and refactor url replacer
    if (process.env.NODE_ENV !== 'production') {
      if (Platform.OS === 'android') {
        const androidHost = liveuiConfig.androidHost || '10.0.2.2';
        fetchtUrl = `${fetchtUrl.replace('localhost', androidHost)}.js`;
      }
    }
    fetch(fetchtUrl, { method: 'GET' })
      .then(response => response.text())
      .then(js => {
        const _exports = ViewBuilder.build(js, onError);
        if (_exports) {
          lruCache && lruCache.put(componentUrl, _exports);
          setExports(_exports);
          setStatus(ComponentStatus.success);
        } else {
          setStatus(ComponentStatus.error);
        }
      })
      .catch(e => {
        const _exports = onError('Remote Component fetch failed', -200, e);
        lruCache && lruCache.delete(componentUrl);
        if (_exports) {
          lruCache && lruCache.put(componentUrl, _exports);
          setExports(_exports);
          setStatus(ComponentStatus.success);
        }
        setError(e);
        if (!_exports) {
          setStatus(ComponentStatus.error);
        }
      });
  }

  const Component =
    (exports && exports[form?.component || name]) || exports?.default;
  const StatusDisplayComponent = placeholder || Status;

  if (!Component && status !== ComponentStatus.success) {
    return (
      (!!StatusDisplayComponent && (
        <StatusDisplayComponent
          form={form || { component: name }}
          status={status}
          action={fetchComponent}
          error={error}
          {...props}
        />
      )) ||
      null
    );
  }
  return (!!Component && <Component {...compProps} />) || null;
};

RemoteComponent.defaultProps = {
  onError: (message: any, code: any, error: any) => {
    console.error(message, code, error);
    return null;
  },
  cached: false,
};

RemoteComponent.propTypes = {
  url: PropTypes.string,
  name: PropTypes.string,
  form: PropTypes.object,
  placeholder: PropTypes.func,
  source: PropTypes.string,
  onError: PropTypes.func,
  cached: PropTypes.bool,
};

export default RemoteComponent;
