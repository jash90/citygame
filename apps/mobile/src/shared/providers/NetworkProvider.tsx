import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import NetInfo, {
  NetInfoStateType,
  type NetInfoState,
} from '@react-native-community/netinfo';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: NetInfoState['type'];
}

const DEFAULT_STATUS: NetworkStatus = {
  isConnected: true,
  isInternetReachable: null,
  type: NetInfoStateType.unknown,
};

const NetworkContext = createContext<NetworkStatus>(DEFAULT_STATUS);

export const useNetworkStatus = (): NetworkStatus => useContext(NetworkContext);

export const useIsOnline = (): boolean => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  // Treat `null` reachability as online — NetInfo only sets it to `false`
  // when it has affirmatively probed and failed.
  return isConnected && isInternetReachable !== false;
};

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider = ({ children }: NetworkProviderProps): React.JSX.Element => {
  const [status, setStatus] = useState<NetworkStatus>(DEFAULT_STATUS);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    void NetInfo.fetch().then((state) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return (
    <NetworkContext.Provider value={status}>{children}</NetworkContext.Provider>
  );
};
