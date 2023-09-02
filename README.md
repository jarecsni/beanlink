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

```
As you can see, there is a level of abstraction here: Tile has no knowledge of TilesContainer, they are only cooperating via an API. It means that the Tile component is reusable by another app, it can be contained by another component, etc.
```
```
// With this call the Tile component obtains the parent BeanLink instance and also
// creates its own instance (stored in context to be used by itself and its children)
const { beanLink, parentBeanLink } = BeanLink.getInstance('Tile');

// in the close button's event handler:
function onCloseTile() {
    parentBeanLink.publish(closeTile.event(id));
}
```
Inside the `TilesContainer` you will find the following code enabling the TilesContainer to react to a Tile wanting to close itself:

```
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







In your entry to your Svelte Kit application (usually your main +page.svelte file, or a main component you include in it), you will usually perform the following few operations:

```
FeatureManager.instance.registerFeature(new BookingFeature());
```
Announcing your `Features` to the `FeatureManager` is key so that later on your features get the necessary callbacks when a component decides to create a new BeanLink instance.

```
IMPORTANT
BeanLink instances are scoped to the component context (using Svelte's component context API). Components can only send and receive messages from their close neighbours, parent context or their own. 

The only exception is features, which obtain reference to the BeanLink instance and can use it to send messages although a feature is not part of the component tree, and therefore it is not part of the context tree either.
```


If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npm create svelte@latest

# create a new project in my-app
npm create svelte@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Everything inside `src/lib` is part of your library, everything inside `src/routes` can be used as a showcase or preview app.

## Building

To build your library:

```bash
npm run package
```

To create a production version of your showcase app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Publishing

Go into the `package.json` and give your package the desired name through the `"name"` option. Also consider adding a `"license"` field and point it to a `LICENSE` file which you can create from a template (one popular option is the [MIT license](https://opensource.org/license/mit/)).

To publish your library to [npm](https://www.npmjs.com):

```bash
npm publish
```
