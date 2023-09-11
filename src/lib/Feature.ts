
/**
 * The interface for a `Feature`.
 * 
 * A feature is a central or global concept, as opposed to a component. Features represent the business of the application, and as such they often assemble
 * the state of multiple components residing in different BeanLink instances (or Svelte subtrees), and subscribe and send messages to these components to coordinate
 * their behaviour.
 */
export type Feature = {
    /**
     * Call back for the {@link FeatureManager} to call during registration, this is where you register your 
     * `Feature` with the various {@link BeanLink} contexts (aka component subtrees), subscribing to various events, etc.
     */
    setup():void;

    /**
     * For logging purposes this method is for returning the name of your `Feature`.
     */
    get name():string
}