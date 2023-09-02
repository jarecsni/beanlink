import type { Feature } from './Feature';

export class FeatureManager {
    private static _instance:FeatureManager = new FeatureManager();
    private features:Map<String, Feature> = new Map();
    private constructor() {
    }
    public static get instance():FeatureManager {
        return FeatureManager._instance;
    }
    public registerFeature(feature:Feature) {
        this.features.set(feature.name, feature);
        feature.setup();
    }
}