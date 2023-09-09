import { beforeAll, beforeEach, expect, suite, test, vi } from 'vitest';

import { getContext, setContext } from 'svelte';
import { BeanLink } from './BeanLink';

const context:Map<string, unknown> = new Map();

vi.mock('svelte', () => ({
    getContext: (key:string) => (context.get(key)),
    setContext: (key:string, value:unknown) => {context.set(key, value);}
}));

beforeEach(() => {
    context.clear();
});

suite('BeanLink', () => {
    suite('Basics', () => {
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
            const {beanLink, parentBeanLink} = BeanLink.getInstance('anotherTest');
            expect(parentBeanLink === parentInstance).toBe(true);
        });
    });
});