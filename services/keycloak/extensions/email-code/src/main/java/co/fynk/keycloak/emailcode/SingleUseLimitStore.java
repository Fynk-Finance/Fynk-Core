package co.fynk.keycloak.emailcode;

import java.util.Map;
import org.keycloak.models.SingleUseObjectProvider;

/** {@link LimitStore} backed by Keycloak's single-use object cache. */
public final class SingleUseLimitStore implements LimitStore {

    private final SingleUseObjectProvider delegate;

    public SingleUseLimitStore(SingleUseObjectProvider delegate) {
        this.delegate = delegate;
    }

    @Override
    public boolean putIfAbsent(String key, long lifespanSeconds) {
        return delegate.putIfAbsent(key, lifespanSeconds);
    }

    @Override
    public Map<String, String> get(String key) {
        return delegate.get(key);
    }

    @Override
    public void put(String key, long lifespanSeconds, Map<String, String> notes) {
        delegate.put(key, lifespanSeconds, notes);
    }

    @Override
    public boolean replace(String key, Map<String, String> notes) {
        return delegate.replace(key, notes);
    }

    @Override
    public void remove(String key) {
        delegate.remove(key);
    }
}
