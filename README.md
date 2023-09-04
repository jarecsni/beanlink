# BeanLink

BeanLink is an event based frontend application framework.

It has no global store (since when global variables are a good idea right? ;), its main design goal is to encourage component reuse and prevent leaking logic and data into global space - which is usually hindering reuse. If you think about it, only the presentation tier is kept in a typical React component, all the rest is implemented in hard or impossible to reuse 'reducers', 'stores' and other central contstructs in main stream frontend applications.

BeanLink has two main concepts: components and features. 

Components are standalone, isolated units which have presentation, state and logic all contained inside them (encapsulation). They can be configured by properties and they can participate in collaborations with their environment (components in the parent context or in their own) via messages. 

Features can also communicate with components to carry out a specific, usually application specific task. Features are somewhat reminiscent of reducers and stores, they are global, and as of now, not designed to be reusable (this might change in the future though).

## Usage
The examples below are all from a test application, [`hello-beanlink`](https://github.com/jarecsni/hello-beanlink).

### Components
First let's see how BeanLink is used in components.

In the `hello-beanlink` example we have a scenario where there is a `TilesContainer` component containing `Tile`s. Each `Tile` has a close button, and when the close button is pressed, the `Tile` needs to send a message for its parent context (containing context), to let it know that it should remove itself. 

```ts
// With this call the Tile component obtains the parent BeanLink instance and also
// creates its own instance (stored in context to be used by itself and its children)
const { beanLink, parentBeanLink } = BeanLink.getInstance('Tile');

// in the close button's event handler:
function onCloseTile() {
    parentBeanLink.publish(closeTile.event(id));
}
```

As you can see, there is a level of abstraction here: Tile has no knowledge of TilesContainer, they are only cooperating via an API. It means that the Tile component is reusable by another app, it can be contained by another component, etc.

Inside the `TilesContainer` you will find the following code enabling the TilesContainer to react to a Tile wanting to close itself:

```ts
const { beanLink, parentBeanLink } = BeanLink.getInstance('TilesContainer');
/// ....
const closeTileListener = (event:ReturnType<typeof closeTile.event>) => {
    const index = tiles.findIndex((element) => element.id === event.value);
    if (index !== -1) {
        Streamer.getInstance().disconnect(tiles[index].symbol!, tiles[index].streamHandler!);
        tiles.splice(index, 1);
        tiles = tiles;
    }
};
beanLink.on(closeTile, closeTileListener);
```
Bear in mind `beanLink` is the context instance created by the `TilesContainer`, so any `Tile` children will see this as their 'parentBeanLink'.

BeanLink instances propagate down the containment tree (as per the semantics of the setContext() Svelte API) - if a component only wants to use the existing context, without creating a new one it is perfectly fine to do so:

```ts
const { beanLink } = BeanLink.getInstance(); 

// or even
const { beanLink, parentBeanLink } = BeanLink.getInstance();
```
`beanLink` and `parentBeanLink` will be the same instance in this case.

### Weak references
BeanLink by default is keeping a weak reference to event handlers. This is to make sure BeanLink does not introduce memory leaks by holding onto listeners defined by Svelte components which have been unmounted. 

> [!WARNING]
> Therefore you should NEVER pass your event listeners as inline functions (as there will be no reference held on those by your code, they will be eligible for garbage collection the moment you hand them over to BeanLink).

As you can see in the code example above, you should always create a variable in your component code, and pass that variable to BeanLink. 

(In some circumstances you might want to tell BeanLink to keep a reference to a handler, we will discuss this later on when we talk about Features.)

### Events
To start off, all events in BeanLink are of the same basic shape, they are all state change events. If you think about it, everything that happens in an app can be expressed by state changes. That is true even for things, like a click of a button (ok, as you will see that state change event is defined to have `void` as its value which makes sense as there is nothing to store as state for a button click).


BeanLink events have the following basic structure:
```ts
export type BeanLinkEvent<T> = {
    name:string,
    value:T,
}
```

And this is how you create an event:
```ts
export const counterpartyChanged = createEvent<Counterparty>('counterparty');
```

The generic type parameter tells `createEvent` about the type of the state change event's `value` parameter.

To be more precise, `createEvent` returns the following structure:
```ts
export type BeanLinkEventCreator<T> = {
    name: string,
    event: (value:T) => (BeanLinkEvent<T>)
}
```

It returns a structure with the name of the event along with the actual event creator function you can use to create a new instance of the specific event:

```ts
$: {
    beanLink.publish(counterpartyChanged.event(selectedCounterparty));
}
```
In the above code, using Svelte's reactivity marker $, the component fires off a change event, whenever the `selectedCounterparty` changes.

The `value` property of a BeanLink event can be anything, any object or even void.

### Features
Related components (those on the same subtree or context) can thus nicely interact with each other via messages, but for any reasonable application we do need some cross cutting concerns, or central stuff, that implements the business of the application (be it booking a deal, placing an order etc.) These things often need to assemble information from many otherwise unrelated parts of the UI (some might no longer be showing on screen, think a multi step wizard for example). Enter features.

Basically a `Feature` is something you register with the `FeatureManager`, for it to be called back when a new `BeanLink` instance is created for a context the `Feature` is interested in, like so:
```ts
    FeatureManager.instance.registerFeature(new BookingFeature());
```
The `BookingFeature` implements the `Feature` interface, most importantly providing a `setup()` method where it can define what events it is interested in:
```ts
setup():void {        
    BeanLink.registerFeature('App', this.name, (beanLink:BeanLink) => {
        beanLink.on(counterpartyChanged.name, this.counterpartyListener);
    });
    BeanLink.registerFeature('Tile', this.name, (beanLink:BeanLink) => {
        console.log('registering BookingFeature for tile context');
        beanLink.on(bookDeal, (event:ReturnType<typeof bookDeal.event>) => {
            console.log('[BookingFeature]', 'booking deal...', JSON.stringify(event.value));
            setTimeout(() => {
                beanLink.publish(bookDealDone.event());
            }, 2000);
        }, false);
    });
}
```
_Notice how the second event registration has an extra `false` parameter:
```ts
    beanLink.on(bookDeal, () => {}, false)
```
This is to tell `BeanLink` to store a strong reference to this function (the default behaviour would be to use a WeakRef). WeakRef would not work in this case for the following not so straightforward reason: this event handler needs to have access to the `beanLink` instance passed in, however if it is defined as a variable, we cannot associate it with the beanLink instance (and there can potentially be multiple `'Tile'` contexts, as each pricing tile will create one for itself.)

It is absolutely no problem to create a hard reference here, given this is a `Feature`, so it will be in memory throughout the life of the application.