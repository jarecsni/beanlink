import type { Feature } from './Feature';

/**
 * Register `Feature`s with BeanLink.
 * This class is used for registering your `Feature`s in your app - `FeatureManager` in turn will call the {@link Feature#setup} method in your `Feature`.
 */
export class FeatureManager {
    private static _instance:FeatureManager = new FeatureManager();
    private features:Map<String, Feature> = new Map();
    private constructor() {
    }
    /**
     * Returns the singleton instance of `FeatureManager`.
     */
    public static get instance():FeatureManager {
        return FeatureManager._instance;
    }

    /**
     * Registers the specified `Feature` with the `FeatureManager`.
     * @param feature - the {@link Feature} to register
     */
    public registerFeature(feature:Feature) {
        this.features.set(feature.name, feature);
        feature.setup();
    }
}