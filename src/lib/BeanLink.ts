import moment from 'moment';
import { getContext, setContext } from 'svelte';

/**
 * All events for `BeanLink` are state change events, with a name and value.
 * The `T` type parameter describes the type of the value.
 * 
 * @typeParam T - the type of the event payload's value
 */
export type BeanLinkEvent<T> = {
    /** the name of the piece of state this even represents */
    name:string,
    /** the current value of the state at the time of this event being generated */
    value:T,
}

/**
 * Event creator is a structure consisting of the name of the event and the actual creator function.
 * 
 * @typeParam T - the type of the event payload's value
 */
export type BeanLinkEventCreator<T> = {
    /** the name of the event to be created */
    name: string,
    /** the event creator function */
    event: (value:T) => (BeanLinkEvent<T>)
}

/**
 * Event handler functions are registered for events and called by `BeanLink`
 * 
 * @typeParam T - the type of the event payload's value
 * @param event - the event to handle
 */
export type BeanLinkEventHandler<T> = (event:BeanLinkEvent<T>) => void;

/**
 * Predicates are used for filtering events. 
 * 
 * @remarks
 * For example you have a few stock market price display components shown. Each registers for
 * `priceUpdate` events. But you want each individual price display component to be updated only 
 * for the symbol it represents. You can create a predicate function like below to achieve this:
 * 
 * @example
 * ```
 * const predicate = (event: ReturnType<typeof priceTickReceived.event>) => (
 *    event.value.symbol === selectedSymbol
 * );
 * ```
 * 
 * You can pass the predicate as part of your call to `BeanLink.on(...)`, providing it in the options 
 * object.
 * 
 * @typeParam T - the type of the event payload's value
 */
export type BeanLinkPredicate<T> = (event:BeanLinkEvent<T>) => boolean;

/**
 * `BeanLinkEventHandlerOptions` can be passed in as the last parameter for the event registration (`BeanLink#on()`)
 * 
 * @typeParam T - the type of the event payload's value
 */
export type BeanLinkEventHandlerOptions<T> = {
    /** this option is true by default, only need to be specified if you want BeanLink to hold a strong reference to your event handler */
    weak?:boolean,
    /** a `BeanLinkPredicate` used to filter events by payload contents. For an example {@link BeanLinkPredicate} */
    predicate?: BeanLinkPredicate<T>
};

const eventNames:Map<string, string> = new Map();

/**
 * 
 * @param name - the name of the event, this must be unique (BeanLink throws an Error if you try to specify an event that's already defined)
 * @returns BeanlinkEventCreator instance configured with the name and the type `T`
 * @throws Error if an event with the specified `name` already exists.
 * @example 
 * ```
 * export const counterpartyChanged = createEvent<Counterparty>('counterparty');
 * ```
 */
export const createEvent = <T>(name:string):BeanLinkEventCreator<T> => {
    if (eventNames.get(name)) {
         throw new Error('Event with name "' + name + '" already exists.');
    } else {
        eventNames.set(name, name);
    }
    return {
        name,
        event: ((value:T) => ({name, value}))
    };
}

type ContextInitCallback = (beanLink:BeanLink) => void;

/**
 * The main class for the framework, contains logic for context based registration and event dispatch.
 */
export class BeanLink {
    
    private _name:string;
    private _handlers:Map<string, {
        handlerRef: (WeakRef<BeanLinkEventHandler<any>> | BeanLinkEventHandler<any>),
        predicate?: BeanLinkPredicate<any>
    }[]> = new Map();
    private static featureMap:Map<string, ContextInitCallback[]> = new Map();
    
    private constructor(name:string) {
        this._name = name;
    }

    /**
     * Registers a {@link Feature} with `BeanLink` for a specified `context`.
     * 
     * @param context Whenever a new `BeanLink` instance is created for a context with the specified name, the `Feature` will be given a callback to 
     * allow it to register event handlers etc.
     * @param featureName name of the Feature
     * @param initCallback the callback function to call whenever a new `BeanLink` instance is created for this specified context ID. 
     */
    public static registerFeature(context:string, featureName:string, initCallback:ContextInitCallback) {
        let features = BeanLink.featureMap.get(context);
        if (!features) {
            features = [];
            BeanLink.featureMap.set(context, features);
        }
        features.push(initCallback);
        BeanLink.log('register feature', 'context = ' + context + ', feature = ' + featureName);
    }

    private static initialiseFeatures(context:string, beanLinkInstance:BeanLink) {
        const contextInitCallbacks = BeanLink.featureMap.get(context);
        contextInitCallbacks && contextInitCallbacks.forEach(cb => {
            cb(beanLinkInstance);
        });
    }

    /**
     * Returns `BeanLink` instances (one for current component context, one for parent - the two might be the same).
     * 
     * @param contextId - a string identifier for the context or subtree the BeanLink instance is going to be used for. Once a name is provided to BeanLink,
     * it will create a new instance and set it in the context (Svelte component context) saving the previously set BeanLink instance (if any) as `parentBeanLink`.
     * If no name is specified, it simply returns the `beanLink` and `parentBeanLink` as found in the Svelte component context. 
     * 
     * @returns the appropriate `beanLink` and `parentBeanLink` instances in an object
     */
    public static getInstance(contextId?:string): {beanLink:BeanLink, parentBeanLink:BeanLink} {
        let beanLink = getContext('beanLink') as BeanLink;
        let parentBeanLink:BeanLink = beanLink;
        if (!beanLink || (contextId && (contextId !== beanLink.name))) {
            if (contextId) {
                beanLink = new BeanLink(contextId);
                console.log('created new instance for ' + contextId)
                BeanLink.initialiseFeatures(contextId, beanLink);
            } else {
                throw new Error('no BeanLink instance in Svelte context found');
            }
            parentBeanLink = getContext('beanLink');
            setContext('beanLink', beanLink);
            setContext('parentBeanLink', parentBeanLink);
        }
        return {
            beanLink,
            parentBeanLink
        }
    }

    /**
     * Gets the name of the intance (the name is the context id passed in as a parameter for {@link getInstance})
     */
    get name() {
        return this._name;
    }

    /**
     * Publishes an event in this current instance. It is important to understand that `BeanLink` is not an application wide
     * event bus. It only passes events within its instance - and this is to ensure, communication between components is done in a controlled way, only
     * structurally related components can talk to each other.
     * 
     * The current implementation publishes events synchronously.
     * 
     * @param event - the event to publish
     */
    public publish<T>(event:BeanLinkEvent<T>) {
        BeanLink.log('publish start', event.name + ' = ' + JSON.stringify(event.value));
        const handlers = this._handlers.get(event.name);
        const recycledRefs:unknown[] = [];
        if (handlers) {
            handlers.forEach(handler => {
                const handlerRef = (handler.handlerRef instanceof WeakRef) ? handler.handlerRef.deref() : handler.handlerRef;
                if (!handlerRef) {
                    recycledRefs.push(handler);
                } else {
                    if (!handler.predicate || (handler.predicate && handler.predicate(event))) {
                        handlerRef(event);
                    }
                }
            });
            if (recycledRefs.length !== 0) {
                recycledRefs.forEach(ref => {
                    const i = handlers.findIndex(e => e === ref);
                    handlers.splice(i, 1);
                });
                BeanLink.log('cleanup', recycledRefs.length + ' obsolete handler references removed');
            }
        }
        BeanLink.log('publish done', event.name);
    }

    /**
     * Registers an event handler with the current `BeanLink` instance.
     * 
     * @param event - the event type or event string to register the handler for 
     * @param handler - the handler function 
     * @param options - two options supported currently: 'weak' (defaults to true) is telling `BeanLink` wether we want to store hard references (NOT recommended in 
     * component code, only in `Feature`s as components might get recycled, and such hard references can easily lead to memory leaks.) The other supported option is
     * `predicate`, which is a function used for filtering events. If a predicate is provided it will be used to decide whether the handler needs to be invoked for a given 
     * event that would otherwise match by registration. This can be useful if there is a need to distinguish events based on event contents {@link BeanLinkEventHandlerOptions} 
     */
    public on<T>(event:BeanLinkEventCreator<T>, handler:BeanLinkEventHandler<T>, options?:BeanLinkEventHandlerOptions<T>): void;
    public on<T>(event:string, handler:BeanLinkEventHandler<T>, options?:BeanLinkEventHandlerOptions<T>):void;
    public on<T>(event: string | BeanLinkEventCreator<T>, handler:BeanLinkEventHandler<T>, options?:BeanLinkEventHandlerOptions<T>):void {
        const eventName = typeof event === 'string' ? event : event.name;
        const weak = options?.weak;
        const predicate = options?.predicate;
        let handlers = this._handlers.get(eventName);
        if (!handlers) {
            handlers = [];
            this._handlers.set(eventName, handlers);
        }
        //this.log('register', 'name='+eventName+', handler='+handler);
        const handlerRef = weak? new WeakRef(handler) : handler; 
        handlers.push({
            handlerRef,
            predicate
        });
    }
    
    static log(action:string, message:string) {
        console.log('[beanlink:' + action + '][' + moment().format() + ']:', message);
    }
    static warn(action:string, message:string) {
        console.log('[warning - beanlink:' + action + '][' + moment().format() + ']:', message);
    }
}