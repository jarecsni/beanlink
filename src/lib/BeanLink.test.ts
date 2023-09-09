import { beforeAll, beforeEach, expect, suite, test, vi } from 'vitest';

import { getContext, setContext } from 'svelte';
import { BeanLink } from './BeanLink';

class Stack<T> {
    private items: T[] = [];

    push(item: T): void {
        this.items.push(item);
    }

    pop(): T | undefined {
        return this.items.pop();
    }

    peek(): T | undefined {
        return this.items[this.items.length - 1];
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }

    size(): number {
        return this.items.length;
    }

    has(item: T): boolean {
        return this.items.includes(item);
    }

    clear(): void {
        this.items = [];
    }
}

const contextStack:Stack<Map<string, unknown>> = new Stack();

vi.mock('svelte', () => ({
    getContext: (key:string) => (contextStack.peek()!.get(key)),
    setContext: (key:string, value:unknown) => {contextStack.peek()!.set(key, value);}
}));

beforeEach(() => {
    contextStack.clear();
    contextStack.push(new Map());
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
    });
});