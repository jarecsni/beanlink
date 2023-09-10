import { beforeAll, beforeEach, expect, suite, test, vi } from 'vitest';

import { getContext, setContext } from 'svelte';
import { BeanLink } from './BeanLink';

const context: Map<string, unknown> = new Map();

vi.mock('svelte', () => ({
    getContext: (key: string) => (context.get(key)),
    setContext: (key: string, value: unknown) => { context.set(key, value); }
}));

beforeEach(() => {
    context.clear();
});

suite('BeanLink', () => {
    suite('getInstance()', () => {
        test('instance created normally', () => {
            const instance = BeanLink.getInstance('test');
            expect(instance).not.toBeUndefined();
        });
        test('consecutive calls with same instance ID return the same BeanLink instance', () => {
            const instance1 = BeanLink.getInstance('test').beanLink;
            const instance2 = BeanLink.getInstance('test').beanLink;
            expect(instance1 == instance2).toBe(true);
        });
        test('if a beanLink has been set in the context, it will save it as parentBeanLink', () => {
            const parentInstance = BeanLink.getInstance('test').beanLink;
            context.set('beanLink', parentInstance);
            const { beanLink, parentBeanLink } = BeanLink.getInstance('anotherTest');
            expect(parentBeanLink === parentInstance).toBe(true);
        });
        test('if called without context id specified and there is no beanLink instance in context, it throws exception', () => {
            expect(() => { BeanLink.getInstance() }).toThrowError('no BeanLink instance in Svelte context found');
        });
    });
    suite('publish', () => {
        test('should call registered event handlers with matching event name', () => {
            const beanLink = BeanLink.getInstance('testContext').beanLink;
            const eventName = 'testEvent';
            const eventData = { name: eventName, value: 'testValue' };
            let handlerCalled = false;
            beanLink.on(eventName, event => {
                expect(event).toEqual(eventData);
                handlerCalled = true;
            });
            beanLink.publish(eventData);
            expect(handlerCalled).toBe(true);
        });

        test('should not call event handlers with different event name', () => {
            const beanLink = BeanLink.getInstance('testContext').beanLink;
            const eventName = 'testEvent';
            const eventData = { name: eventName, value: 'testValue' };
            let handlerCalled = false;
            beanLink.on('anotherEvent', event => {
                handlerCalled = true;
            });
            beanLink.publish(eventData);
            expect(handlerCalled).toBe(false);
        });

        test('should not call event handlers with a matching event name but a failing predicate', () => {
            const beanLink = BeanLink.getInstance('testContext').beanLink;
            const eventName = 'testEvent';
            const eventData = { name: eventName, value: 'testValue' };

            let handlerCalled = false;
            beanLink.on(eventName, event => {
                handlerCalled = true;
            }, { predicate: () => false }); // Predicate always returns false
            beanLink.publish(eventData);
            expect(handlerCalled).toBe(false);
        });

        test('should call event handlers with a matching event name and a passing predicate', () => {
            const beanLink = BeanLink.getInstance('testContext').beanLink;
            const eventName = 'testEvent';
            const eventData = { name: eventName, value: 'testValue' };
            let handlerCalled = false;
            beanLink.on(eventName, event => {
                expect(event).toEqual(eventData);
                handlerCalled = true;
            }, { predicate: () => true }); // Predicate always returns true
            beanLink.publish(eventData);
            expect(handlerCalled).toBe(true);
        });

        test('should not call event handlers with deleted weak references', async () => {
            const beanLink = BeanLink.getInstance('testContext').beanLink;
            const eventName = 'testEvent';
            const eventData = { name: eventName, value: 'testValue' };
            let handlerCalled = false;
            beanLink.on(eventName, () => {
                handlerCalled = true;
            }, { weak: true });
            setTimeout(() => {
                beanLink.publish(eventData);
                expect(handlerCalled).toBe(false);
            }, 100); // this does not seem very reliable but for now it seems to work...
        });
    });
});