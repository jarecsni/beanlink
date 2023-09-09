import moment from 'moment';
import { getContext, setContext } from 'svelte';

/**
 * All events for `BeanLink` are state change events, with a name and value.
 * The `T` type parameter describes the type of the value.
 * 
 * @param name - the name of the piece of state this even represents
 * @param value - the current value of the state at the time of this event being generated 
 */
export type BeanLinkEvent<T> = {
    name:string,
    value:T,
}

/**
 * Event creator is a structure consisting of the name of the event and the actual creator function.
 * 
 * @param name - the name of the event to be created
 * @param event - the event creator function
 */
export type BeanLinkEventCreator<T> = {
    name: string,
    event: (value:T) => (BeanLinkEvent<T>)
}

/**
 * Event handler functions are registered for events and called by `BeanLink`
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
 */
export type BeanLinkPredicate<T> = (event:BeanLinkEvent<T>) => boolean;

/**
 * `BeanLinkEventHandlerOptions` can be passed in as the last parameter for the event registration (`BeanLink#on()`)
 */
export type BeanLinkEventHandlerOptions<T> = {
    /** this option is true by default, only need to be specified if you want BeanLink to hold a strong reference to your event handler */
    weak?:boolean,
    /** a `BeanLinkPredicate` used to filter events by payload contents. For an example @see {@link BeanLinkPredicate} */
    predicate?: BeanLinkPredicate<T>
};

const eventNames:Map<string, string> = new Map();

/**
 * 
 * @param name - the name of the event, this must be unique (BeanLink throws an Error if you try to specify an event that's already defined)
 * @returns BeanlinkEventCreator instance configured with the name and the type `T`
 * @throws Error if an event with the specified `name` already exists.
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

    public static registerFeature(context:string, feature:string, initCallback:ContextInitCallback) {
        let features = BeanLink.featureMap.get(context);
        if (!features) {
            features = [];
            BeanLink.featureMap.set(context, features);
        }
        features.push(initCallback);
        BeanLink.log('register feature', 'context = ' + context + ', feature = '+feature);
    }

    private static initialiseFeatures(context:string, beanLinkInstance:BeanLink) {
        const contextInitCallbacks = BeanLink.featureMap.get(context);
        contextInitCallbacks && contextInitCallbacks.forEach(cb => {
            cb(beanLinkInstance);
        });
    }

    public static getInstance(contextId?:string) {
        let beanLink = getContext('beanLink') as BeanLink;
        let parentBeanLink:BeanLink = beanLink;
        if (!beanLink || (contextId && (contextId !== beanLink.name))) {
            if (contextId) {
                beanLink = new BeanLink(contextId);
                BeanLink.initialiseFeatures(contextId, beanLink);
            } else {
                throw new Error('Assumed beanLink in context where none exists - with no ID provided, none can be created either.');
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

    get name() {
        return this._name;
    }

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