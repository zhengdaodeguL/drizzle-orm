import postgres, { type ReservedSql } from 'postgres';
import { expect, it, vi } from 'vitest';
import { integer, pgTable } from '~/pg-core/index.ts';
import { drizzle } from '~/postgres-js/index.ts';
import { sql } from '~/sql/sql.ts';

function createReservedClient() {
	const values = vi.fn().mockResolvedValue([[1]]);
	const unsafe = vi.fn(() => Object.assign(Promise.resolve([{ id: 1 }]), { values }));
	// Match reserve()'s runtime surface: it has no pool options or begin().
	const reserved = Object.assign(vi.fn(), { unsafe, release: vi.fn() }) as unknown as ReservedSql;
	const client = Object.assign(reserved, { options: postgres().options });
	return { client, unsafe, values };
}

it.each(['direct', 'config'] as const)('queries a reserved client with %s arguments', async (mode) => {
	const { client, unsafe, values } = createReservedClient();
	const db = mode === 'direct' ? drizzle(client) : drizzle({ client });
	const users = pgTable('users', { id: integer().notNull() });

	expect(db.$client).toBe(client);
	expect(await db.execute(sql`select ${1} as id`)).toEqual([{ id: 1 }]);
	expect(unsafe).toHaveBeenCalledWith('select $1 as id', [1], { prepare: false });

	expect(await db.select().from(users)).toEqual([{ id: 1 }]);
	expect(unsafe).toHaveBeenLastCalledWith('select "id" from "users"', [], { prepare: false });
	expect(values).toHaveBeenCalledOnce();
});

it('rejects transactions on a reserved client without begin()', () => {
	const { client, unsafe } = createReservedClient();
	const db = drizzle({ client });
	const transaction = vi.fn();

	expect(() => db.transaction(transaction)).toThrow('Transactions are not supported by this postgres-js client');
	expect(transaction).not.toHaveBeenCalled();
	expect(unsafe).not.toHaveBeenCalled();
});
