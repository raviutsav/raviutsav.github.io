---
title: "So You Think You Understand Database Indexes? Part 1"
description: "A first-principles look at database pages, B+ trees, clustered and nonclustered indexes, key lookups, and why an index seek is not always faster than a scan."
pubDate: 2026-10-24
tags: ["Databases", "SQL", "Backend Engineering"]
featured: true
isSample: false
---

## Table of Contents

- [First, how does a database store data?](#first-how-does-a-database-store-data)
- [The basic idea behind an index](#the-basic-idea-behind-an-index)
- [An index is also data. It needs an efficient way to be searched.](#an-index-is-also-data-it-needs-an-efficient-way-to-be-searched)
- [Finding a row is not the same as retrieving the entire row](#finding-a-row-is-not-the-same-as-retrieving-the-entire-row)
- [When an index can be slower than a scan](#when-an-index-can-be-slower-than-a-scan)
- [Covering indexes: when the index contains everything the query needs](#covering-indexes-when-the-index-contains-everything-the-query-needs)
- [One last piece: what about clustered indexes?](#one-last-piece-what-about-clustered-indexes)
- [So, what should we take away from all this?](#so-what-should-we-take-away-from-all-this)

Do you understand indexes deeply enough to actually use them to optimize database queries?

I thought I did. I knew what indexes were, why we needed them, and the difference between clustered and nonclustered indexes.

But knowing what an index is and understanding how it affects the work a database engine has to do are two very different things.

Let's try to understand this from first principles.

## First, how does a database store data?

A table looks like a collection of rows. You insert a row, retrieve a row, or update a row.

But internally, databases don't usually read data one row at a time from storage. They organize data into units called **pages**.

A page is a fixed-size block of data that the database reads and writes as a unit. In SQL Server, for example, a page is typically 8 KB.

Let's say we have an `Orders` table with the following schema:

```sql
orderId  BIGINT,
itemId   INT,
date     DATE,
Quantity INT
```

For simplicity, let's assume that each page can hold 100 rows.

If we have 1 million rows, we need approximately:

$$
\frac{1,000,000}{100} = 10,000 \text{ pages}
$$

Now, suppose we want to find all orders for a particular item.

```sql
SELECT *
FROM Orders
WHERE itemId = 101;
```

Let's say only 10 rows match this condition.

Here's the question: how does the database know which pages contain those 10 rows?

Without a useful index, it doesn't know.

It has to examine the table's data to find the matching rows. In our simplified example, that means going through all 10,000 pages and examining up to 1 million rows.

The database might already have some of those pages in memory, so this doesn't necessarily mean 10,000 physical disk reads. But it still has to examine the relevant data.

This operation is called a **table scan**.

Think about that for a moment.

We wanted 10 rows, but without a way to locate them efficiently, we might have to examine a million rows to find them.

Can we do better?

## The basic idea behind an index

Imagine maintaining a separate structure that looks something like this:

| itemId | Row locator |
| :--- | :--- |
| 100 | Location A |
| 101 | Location B |
| 101 | Location C |
| 102 | Location D |

This structure is ordered by `itemId`.

When we want `itemId = 101`, we don't have to search the entire table. We can search this ordered structure, find the matching entries, and use their row locators to retrieve the actual rows.

That's the basic idea behind a **nonclustered index**.

One important detail: a nonclustered index doesn't necessarily store the entire table row. It stores the indexed key values, a row locator, and optionally additional columns that we choose to include.

The row locator tells the database how to find the corresponding row in the underlying table.

Its exact form depends on how the table is organized. For example, in SQL Server, a nonclustered index on a heap uses a physical row identifier, while a nonclustered index on a table with a clustered index uses the clustered key as its row locator.

We'll come back to why this distinction matters.

For now, let's focus on the bigger idea.

An index helps the database find the rows it needs without examining every row in the table.

But there's another problem.

What happens when the index itself becomes large?

## An index is also data. It needs an efficient way to be searched.

We just created a separate structure containing indexed values and row locators.

But if our table has a million rows, that structure can also contain a large number of entries.

Searching through every entry in the index would defeat much of the purpose.

So databases organize many indexes using a tree structure called a **B+ tree**.

Let's understand why.

Suppose the index is stored in pages, just like the table data. Each page contains multiple index entries.

Instead of searching through every index page, the database maintains a hierarchy of pages.

At the top, we have the root page. It points us toward the appropriate intermediate pages, which eventually lead to the leaf pages containing the entries we need.

Something like this:

```text
                  Root page
                 /         \
          Intermediate   Intermediate
             pages         pages
            /    \         /    \
         Leaf   Leaf     Leaf   Leaf
         pages  pages    pages  pages
```

Each node represents a page, not an individual row.

The root and intermediate pages help the database navigate the tree. The leaf pages contain the actual index entries.

Because each page can hold many entries, each level can direct the search toward a much smaller portion of the index.

This is why B+ trees are effective for both equality searches, such as `itemId = 101`, and range queries, such as `itemId BETWEEN 100 AND 200`.

Now, finding the matching entries in the index is relatively efficient.

But remember our original query:

```sql
SELECT *
FROM Orders
WHERE itemId = 101;
```

We asked for `*`, which means we want all four columns.

What if our nonclustered index contains only `itemId` and the row locator?

We can find the matching rows, but we still need to retrieve `orderId`, `date`, and `Quantity`.

And that's where things get interesting.

## Finding a row is not the same as retrieving the entire row

Let's say we have a nonclustered index on `itemId`.

```sql
CREATE INDEX IX_Orders_itemId
ON Orders (itemId);
```

Our query is still:

```sql
SELECT *
FROM Orders
WHERE itemId = 101;
```

The database can search the index and find all the entries where `itemId = 101`.

But the index doesn't contain all the columns requested by the query.

So the database has to follow the row locators to retrieve the missing data from the underlying table structure.

If the table has a clustered index, SQL Server calls this additional operation a **Key Lookup**. If the table is a heap, the corresponding operation is a RID Lookup.

Conceptually, the work looks like this:

1. Navigate through the nonclustered index to find the matching entries.
2. Read the row locator from each matching entry.
3. Use those locators to retrieve the complete rows.
4. Return the results.

Notice that we're doing two kinds of work: finding the entries in the index and retrieving the corresponding rows.

The first part might be very efficient. The second part can become expensive.

Why?

Because the number of matching rows matters.

If `itemId = 101` matches just 10 rows, the additional lookups might be perfectly reasonable.

But what if it matches 300,000 rows?

Now the database might need to perform hundreds of thousands of key lookup operations.

And this is where an index that looks useful on paper can become less useful in practice.

## When an index can be slower than a scan

Let's continue with our original table:

- 1 million rows.
- 100 rows per page.
- Approximately 10,000 data pages.

Suppose the query matches 300,000 rows.

```sql
SELECT *
FROM Orders
WHERE itemId = 101;
```

With our nonclustered index, the database can efficiently locate the matching entries. But because the index doesn't contain all the required columns, it also needs to retrieve the matching rows from the clustered index.

In a particularly unfavorable scenario, these lookups can touch a very large number of different data pages.

Now compare that with scanning the table.

If the database scans all 10,000 pages, it can examine all 1 million rows and return the 300,000 matching rows.

The scan reads the data pages in a relatively sequential fashion, while the key lookups may require repeated access to different pages.

Even though the index helps us identify the matching rows, following it with hundreds of thousands of lookups can cost more than simply scanning the table.

To be clear, 300,000 lookups do not necessarily mean 300,000 physical disk reads. Multiple matching rows may live on the same page, and the pages may already be in memory. The actual cost depends on data distribution, caching, the storage engine, and the query plan.

But the underlying lesson remains:

**An index seek is not automatically faster than a scan.**

The database optimizer estimates the cost of different execution plans and chooses what it believes is the most efficient option. When a query returns a large proportion of a table, a scan can be the better choice.

So, can we avoid those extra lookups altogether?

Yes. And this brings us to covering indexes.

## Covering indexes: when the index contains everything the query needs

Remember that the expensive part of our query wasn't necessarily finding the matching `itemId` values. It was fetching the missing columns for every matching row.

What if we stored those columns in the nonclustered index as well?

For example:

```sql
CREATE INDEX IX_Orders_itemId
ON Orders (itemId)
INCLUDE (orderId, date, Quantity);
```

Now the index contains:

- `itemId`, which we use to search.
- `orderId`, `date`, and `Quantity`, which we need to return.

Our original query can potentially be answered entirely from the nonclustered index.

```sql
SELECT *
FROM Orders
WHERE itemId = 101;
```

The index contains all the columns required by the query, so the database no longer needs to perform a key lookup to retrieve the missing values.

Such an index is called a **covering index** for that query.

This can make a substantial difference, especially when a query returns many rows.

There is, however, a trade-off.

By including more columns, we make the index larger. A larger index consumes more storage, requires more pages to be read during searches, and costs more to maintain when rows are inserted, updated, or deleted.

So we shouldn't blindly include every column in every index.

We need to consider the queries we actually run and the workload we are optimizing for.

## One last piece: what about clustered indexes?

So far, we've talked about a nonclustered index as a separate structure that points to the underlying rows.

But we haven't discussed how the table itself is organized.

In SQL Server, a table with a clustered index is organized around the clustered index key. The leaf level of the clustered B+ tree contains the actual data rows.

For example, if we create a clustered index on `orderId`, the clustered index organizes the table by that key.

```sql
CREATE CLUSTERED INDEX CX_Orders_orderId
ON Orders (orderId);
```

The structure now looks conceptually like this:

- The root and intermediate pages help navigate the tree.
- The leaf pages contain the actual table rows, ordered by the clustered index key.

This means that finding a row through the clustered index takes us directly to the page containing the actual data. We don't need another lookup to retrieve columns from that same row.

A nonclustered index, on the other hand, has its own B+ tree. Its leaf pages contain the indexed key values, row locators, and any included columns.

This also explains the distinction we discussed earlier.

When a nonclustered index points to a table with a clustered index, it uses the clustered key as its row locator rather than storing a separate physical row address.

That's one reason why choosing a clustered key matters. A wide clustered key can increase the size of nonclustered indexes because the key is carried into their row locators.

One final nuance: a clustered index organizes the rows by key, but that doesn't mean the database file is permanently arranged as one perfectly contiguous sequence of rows on disk. Page splits, fragmentation, and other storage details affect the physical layout.

The important idea is that the clustered index's leaf level is the table's data, whereas a nonclustered index is a separate structure.

## So, what should we take away from all this?

When optimizing a query, don't stop at asking whether an index exists.

Ask yourself:

- How many rows does the query actually need to examine?
- How many pages might it need to read?
- Does the index contain all the columns the query needs?
- If not, how many additional lookups might be required?
- Would a scan actually be cheaper for this particular query?
- Is the benefit of the index worth the additional storage and write overhead?

An index is not magic. It is another data structure that helps the database do less work in certain situations.

And sometimes, the best way to optimize a query isn't to add another index. It's to understand where the database is spending its time and why.

That's the difference between knowing what indexes are and understanding how to use them.
