---
description: A first-principles look at how databases join tables, and
  how nested loop, hash, and merge joins use indexes and sorted data to
  get the job done.
featured: false
pubDate: 2026-11-12
tags:
- Databases
- Backend Engineering
- SQL
title: "Database Indexes: Understanding Joins - Part 3"
---

## Table of Contents

- [The problem: joining two tables](#the-problem-joining-two-tables)
- [1. Nested Loop Join](#1-nested-loop-join)
- [2. Hash Join](#2-hash-join)
- [3. Merge Join](#3-merge-join)
- [So, which join algorithm is the best?](#so-which-join-algorithm-is-the-best)

In [Part 1](/writing/database-indexes-first-principles-part-1/), we
looked at how indexes work internally, from pages and B+ trees to
clustered and non-clustered indexes.

In [Part 2](/writing/database-indexes-query-plans-statistics-part-2/),
we saw how the database uses statistics to estimate the amount of work a
query might do and choose an execution plan.

There is one important operation we haven't looked at yet: **joining
tables**.

We use joins all the time. But what actually happens when we ask the
database to combine rows from two tables?

Let's take a simple example and build our way up.

## The problem: joining two tables

Let's go back to the `Orders` table we've been using in the previous
articles.

```sql
CREATE TABLE Orders (
    orderId BIGINT,
    itemId INT,
    date DATE,
    quantity INT
);
```

For this example, let's say it contains the following rows:

| orderId | itemId | date | quantity |
| ---: | ---: | :--- | ---: |
| 1 | 101 | 2026-11-01 | 2 |
| 2 | 103 | 2026-11-02 | 1 |
| 3 | 101 | 2026-11-03 | 4 |
| 4 | 102 | 2026-11-04 | 1 |
| 5 | 104 | 2026-11-05 | 3 |

Now let's introduce another table: `Items`.

```sql
CREATE TABLE Items (
    itemId INT,
    itemName VARCHAR(100)
);
```

And a few rows:

| itemId | itemName |
| ---: | :--- |
| 101 | Keyboard |
| 102 | Mouse |
| 103 | Monitor |
| 104 | Headphones |

The `Orders` table tells us which item was ordered, but it doesn't
contain the item's name. That information lives in the `Items` table.

Suppose we want to retrieve the order details along with the
corresponding item name.

```sql
SELECT
    o.orderId,
    i.itemName,
    o.date,
    o.quantity
FROM Orders o
JOIN Items i
    ON o.itemId = i.itemId;
```

The result would look something like this:

| orderId | itemName | date | quantity |
| ---: | :--- | :--- | ---: |
| 1 | Keyboard | 2026-11-01 | 2 |
| 2 | Monitor | 2026-11-02 | 1 |
| 3 | Keyboard | 2026-11-03 | 4 |
| 4 | Mouse | 2026-11-04 | 1 |
| 5 | Headphones | 2026-11-05 | 3 |

At a high level, this is straightforward: for every order, find the item
with the same `itemId` and combine the two rows.

But there are different ways the database can do this.

Let's assume `Orders` has **M rows** and `Items` has **N rows**. The
database optimizer can choose from different join algorithms depending
on the available indexes, the size of the tables, the data distribution,
and its estimates of how much work each approach will require.

We'll look at three common algorithms:

- Nested Loop Join
- Hash Join
- Merge Join

## 1. Nested Loop Join

Let's start with the most straightforward approach.

Take the first row from `Orders`. Look at its `itemId`, find the
matching row in `Items`, and combine them.

Then take the second order and do the same thing. Continue until we've
processed all the orders.

In plain English, the process looks like this:

1. Pick an order.
2. Find the item whose `itemId` matches the order's `itemId`.
3. Combine the rows.
4. Move to the next order.

For our sample data, the first order has `itemId = 101`. We find
`Keyboard` in `Items` and produce the first result row.

The second order has `itemId = 103`, so we find `Monitor`. The third
order has `itemId = 101`, so we find `Keyboard` again.

And so on.

Conceptually, the algorithm looks like this:

```text
for each order in Orders:
    for each item in Items:
        if order.itemId == item.itemId:
            output(order, item)
```

If we have M orders and N items, this simple version may compare each
order with every item. That gives us roughly **M × N comparisons**.

But remember what we learned in Part 1: finding a row doesn't
necessarily mean scanning the entire table. If there is a useful index
on `Items.itemId`, the database can use it to find the matching item
much more efficiently.

For example:

```sql
CREATE INDEX IX_Items_itemId
ON Items (itemId);
```

Now, instead of scanning the entire `Items` table for every order, the
database can use the index to look up the matching `itemId`.

The execution becomes conceptually similar to this:

```text
for each order in Orders:
    item = lookup Items using index on itemId

    if item exists:
        output(order, item)
```

This is where Nested Loop Join becomes interesting.

If `Orders` contains only 10 rows and `Items` contains a million rows,
performing 10 index lookups can be a very reasonable approach. We don't
need to process the entire `Items` table.

But what if `Orders` contains a million rows?

Now we're potentially performing a million index lookups. Each lookup
may be efficient on its own, but doing it a million times can become
expensive.

This is the important point: **an efficient lookup repeated a very large
number of times may still be expensive.**

Nested Loop Join is often a good choice when the outer input is small
and the inner input can be searched efficiently, for example through an
index.

One small detail: the database doesn't have to use an index for Nested
Loop Join. It can scan the inner input too. The index just makes the
repeated lookup approach more attractive when the number of outer rows
is small enough.

## 2. Hash Join

Let's think about the problem with the previous approach.

When we process an order, we look up its `itemId` in the `Items` table.
If we have a large number of orders, we repeat that lookup many times.

Can we avoid repeatedly searching the `Items` table?

We can.

Think about a hash map. We can store a key-value pair in it and retrieve
the value using the key in approximately constant time on average.

For our example, we can build a hash map from the `Items` table:

| Key (`itemId`) | Value (`itemName`) |
| ---: | :--- |
| 101 | Keyboard |
| 102 | Mouse |
| 103 | Monitor |
| 104 | Headphones |

The database can do this in two steps.

**Step 1: Build the hash table**

Read the `Items` table and insert each row into a hash table, using
`itemId` as the key.

```text
Hash table:

101 -> Keyboard
102 -> Mouse
103 -> Monitor
104 -> Headphones
```

**Step 2: Probe the hash table**

Now iterate through the `Orders` table. For every order, use its
`itemId` to look up the corresponding item in the hash table.

For example:

- Order 1 has `itemId = 101` → Keyboard
- Order 2 has `itemId = 103` → Monitor
- Order 3 has `itemId = 101` → Keyboard
- Order 4 has `itemId = 102` → Mouse
- Order 5 has `itemId = 104` → Headphones

The pseudocode would look something like this:

```text
hashTable = empty hash table

for each item in Items:
    hashTable[item.itemId] = item

for each order in Orders:
    item = hashTable.lookup(order.itemId)

    if item exists:
        output(order, item)
```

Notice what changed.

We read the `Items` table once to build the hash table. Then we read the
`Orders` table and perform hash lookups instead of repeatedly searching
the original table.

Building the hash table takes roughly O(N) work, and probing it takes
roughly O(M) work on average.

So, the overall expected work is approximately:

$$
O(M + N)
$$

This makes Hash Join particularly useful when both inputs are large and
an index-based lookup for every row would be expensive.

There is an important detail here. The database generally builds the
hash table using the smaller input, because that is the input it needs
to keep in memory. It then reads the other input and probes the hash
table.

In our example, we've used `Items` as the build side to make the
explanation easy to follow. In a real execution plan, the optimizer may
choose the other side if it estimates that doing so is cheaper.

### Does Hash Join always fit in memory?

Not necessarily.

The hash table needs memory. If the build side is too large to fit in
the memory allocated to the operation, the database may need to
partition data and use temporary storage, often called spilling to disk.

That additional work can make a Hash Join much more expensive than
expected.

Also, a Hash Join is particularly suited to equality joins, such as the
one we're using here:

```sql
ON o.itemId = i.itemId
```

The database can hash the join key and look for matching keys. This
isn't the same approach it would use for a range condition such as
`o.itemId > i.itemId`.

## 3. Merge Join

So far, we've seen two approaches:

- Nested Loop Join repeatedly searches for a matching row.
- Hash Join builds a hash table and uses it to find matching rows.

Now let's look at another approach: Merge Join.

To understand it, remember one important property of a B+ tree index
from Part 1.

**The entries in a B+ tree index are maintained in sorted order of the
indexed key.**

This property can be useful for joining tables.

Suppose we have an index on `Orders.itemId` and another index on
`Items.itemId`.

The database can read the entries from both indexes in sorted order. It
can then walk through the two inputs together, instead of repeatedly
searching one table or building a hash table.

Let's first look at what the sorted data might look like.

**Orders, sorted by `itemId`:**

| orderId | itemId |
| ---: | ---: |
| 1 | 101 |
| 3 | 101 |
| 4 | 102 |
| 2 | 103 |
| 5 | 104 |

**Items, sorted by `itemId`:**

| itemId | itemName |
| ---: | :--- |
| 101 | Keyboard |
| 102 | Mouse |
| 103 | Monitor |
| 104 | Headphones |

Imagine that we have two pointers:

- A left pointer starts at the first row of `Orders`.
- A right pointer starts at the first row of `Items`.

We compare the `itemId` values at the two pointers.

### Let's walk through it

**Step 1**

The left pointer is at `itemId = 101`, and the right pointer is also at
`itemId = 101`.

The values match. So, we combine the rows and produce:

```text
orderId = 1, itemId = 101, itemName = Keyboard
```

There is another order with `itemId = 101`, so that row also matches the
same item.

**Step 2**

The next order has `itemId = 102`, while the item pointer has moved to
`itemId = 102`.

Again, the values match. We produce the corresponding joined row.

**Step 3**

The same process continues for `itemId = 103` and `itemId = 104`.

The important observation is that we don't need to go back to the
beginning of either input. Both inputs are already sorted, so we can
keep moving forward.

Here's the general idea:

```text
while Orders and Items have rows remaining:

    if Orders.itemId == Items.itemId:
        output matching rows
        advance the appropriate pointer(s)

    else if Orders.itemId < Items.itemId:
        advance Orders pointer

    else:
        advance Items pointer
```

The pseudocode above is intentionally simplified. If multiple rows have
the same join key on either side, the database has to produce all
matching combinations. It may need to keep track of a group of duplicate
keys while doing so.

### Why is this efficient?

Think about what happens when the two inputs are already sorted.

We start at the beginning of both inputs and move forward. Each pointer
moves through its input rather than repeatedly starting a new search.

If the inputs contain M and N rows, the basic traversal takes
approximately O(M + N) work, excluding the cost of sorting and the cost
of producing the actual result rows.

That's the interesting part: we can join two large inputs by walking
through them once.

### Where do indexes come into the picture?

This is where our original topic comes back.

A B+ tree index maintains its entries in sorted order. So, if suitable
indexes exist on both joining columns, the database may be able to read
the inputs in the required order without sorting them separately.

For example:

```sql
CREATE INDEX IX_Orders_itemId
ON Orders (itemId);

CREATE INDEX IX_Items_itemId
ON Items (itemId);
```

These indexes can provide the sorted inputs required by a Merge Join.

However, there's an important distinction worth making: **Merge Join
requires sorted inputs, not necessarily indexes.**

If suitable indexes are unavailable, the database can still sort the
inputs before performing the join. But sorting large inputs has a cost,
so using indexes to obtain the required order can sometimes make Merge
Join more attractive.

Also, the existence of these indexes doesn't guarantee that the
optimizer will choose Merge Join. It still compares the estimated costs
of different execution plans.

## So, which join algorithm is the best?

We've now seen three ways of joining tables. Each algorithm is useful
in a different situation.

| Join algorithm | How it works | Often useful when |
| :--- | :--- | :--- |
| Nested Loop Join | For each row in one input, search for matching rows in the other | One input is small, especially when the other has a useful index |
| Hash Join | Build a hash table from one input and probe it using the other | Both inputs are large and the join uses equality |
| Merge Join | Walk through two sorted inputs and match their keys | Both inputs are already sorted, or sorting them is cost-effective |
