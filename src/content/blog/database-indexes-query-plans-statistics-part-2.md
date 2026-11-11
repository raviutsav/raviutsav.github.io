---
title: "Database Indexes: Query Plans and Statistics - Part 2"
description: "Understanding how databases choose between index seeks and table scans, how statistics influence query execution plans, and why cached plans can sometimes go wrong."
pubDate: 2026-11-05
tags: ["Databases", "Backend Engineering", "SQL"]
featured: false
---

In [Part 1](https://raviutsav.github.io/writing/database-indexes-first-principles-part-1/), we explored how database indexes work internally, from pages and B+ trees to clustered and non-clustered indexes.

We also established an important idea: an index helps the database avoid scanning every row when searching for data.

But does that mean the database should always use an index whenever one is available?

Not really.

In fact, there are situations where using an index can be more expensive than simply scanning the entire table.

Let's understand why.

## The Same Query, Two Different Costs

Let's take the same `Orders` table we used in Part 1.

```sql
CREATE TABLE Orders (
    orderId BIGINT,
    itemId INT,
    date DATE,
    Quantity INT
);
```

For this example, let's assume:

- The table contains 1 million rows.
- We have a clustered index on `orderId`.
- We have a non-clustered index on `itemId`.
- Each data page can hold approximately 100 rows.

This means our table occupies roughly 10,000 data pages.

Now, let's introduce one more detail.

The distribution of `itemId` is not uniform.

Out of our 1 million rows:

| itemId | Matching rows | Distribution |
| :--- | ---: | :--- |
| `101` | 200,000 | ~20% of total rows |
| `102` | 10 | Only 10 rows |
| Other values | ~799,990 | Distributed among remaining items |

This uneven distribution is important. We will see why in a moment.

Now, consider a stored procedure that retrieves all orders belonging to a particular item.

```sql
CREATE PROCEDURE getOrdersByItemId
    @itemId_param INT
AS
BEGIN
    SELECT *
    FROM Orders
    WHERE itemId = @itemId_param;
END;
```

Let's execute it with the following parameter:

```sql
EXEC getOrdersByItemId @itemId_param = 101;
```

The database needs to find 200,000 matching rows.

Since we have a non-clustered index on `itemId`, one possible approach is to use it.

### Approach 1: Use the Non-Clustered Index

The database can search the B+ tree of the non-clustered index and locate all entries corresponding to `itemId = 101`.

But there is a problem.

Our non-clustered index only contains the indexed column and the row locator. It doesn't contain all the columns returned by `SELECT *`.

Remember, the actual table data is stored in the clustered index.

So, after finding each matching entry in the non-clustered index, the database needs to go back to the clustered index to retrieve the complete row.

This operation is called a **Key Lookup** in SQL Server.

The execution looks something like this:

```text
Non-Clustered Index Seek
          |
          v
Find 200,000 matching entries
          |
          v
Key Lookup for each matching row
          |
          v
Return complete rows
```

We now have potentially 200,000 key lookups to perform.

An important detail here: rows with the same `itemId` are not necessarily stored next to each other in the clustered index because the table is organized by `orderId`.

In an unfavorable layout, these lookups can involve accessing a large number of different data pages.

### Approach 2: Scan the Entire Table

There is another way.

Instead of using the non-clustered index, the database could simply scan the entire clustered index.

It would read the approximately 10,000 data pages, examine the `itemId` of each row, and return the rows that match our condition.

Something like this:

```text
Start scanning clustered index
          |
          v
Read data pages sequentially
          |
          v
Check itemId for each row
          |
          v
Does itemId = 101?
       /       \
     Yes        No
      |          |
      v          v
 Include row   Skip row
       \         /
        \       /
         Continue
             |
             v
       Return results
```

At first, scanning a million rows might sound expensive.

But compare the two approaches:

- Index approach: Find 200,000 entries and perform potentially many additional key lookups.
- Scan approach: Read approximately 10,000 data pages and examine the rows.

Depending on the data layout and caching, scanning the table can be considerably cheaper.

The database might therefore choose a scan even though an index exists.

Now, let's change just one thing.

What happens if we execute the same stored procedure with a different parameter?

```sql
EXEC getOrdersByItemId @itemId_param = 102;
```

This time, only 10 rows match.

Using the non-clustered index, the database can find 10 matching entries and perform just 10 key lookups.

Compare that with scanning all 10,000 pages to find those same 10 rows.

Clearly, the index approach is much more attractive here.

So, we have an interesting situation:

| Parameter | Matching rows | Potentially better approach |
| :--- | ---: | :--- |
| `itemId = 101` | 200,000 | Table scan |
| `itemId = 102` | 10 | Index seek + key lookup |

These are illustrative choices, not guaranteed outcomes. The actual decision depends on the data layout, index structure, caching, and the database's cost estimates.

But this brings us to an interesting question.

**How does the database know how many rows are likely to match a condition before actually executing the query?**

## How Does the Database Know What to Choose?

Think about it for a moment.

If the database somehow knew that a query would return 200,000 rows, it could reason that using the index and performing a large number of key lookups might not be worthwhile.

Similarly, if it knew that only 10 rows would match, using the index would probably be a better choice.

But how can it know this without executing the query first?

One obvious approach would be to run a `COUNT(*)` query before executing every query.

For example:

```sql
SELECT COUNT(*)
FROM Orders
WHERE itemId = 101;
```

Then, based on the result, the database could decide whether to use an index or scan the table.

But doing this for every query would defeat the purpose. We would be doing additional work just to decide how to perform the actual work.

Instead, databases maintain something called **Statistics**.

## What Are Statistics?

Statistics are metadata maintained by the database that describe the distribution of values in a table or index.

They help the database estimate how many rows are likely to match a particular condition.

Let's go back to our example.

Suppose the database has statistics describing the distribution of `itemId`.

A simplified representation might look like this:

| itemId | Number of rows |
| :--- | ---: |
| 101 | 200,000 |
| 102 | 10 |
| 103 | 4,500 |
| 104 | 4,800 |
| ... | ... |

These numbers help the database understand that the distribution is not uniform.

For example, assuming every `itemId` occurs equally often would lead to a very different estimate than knowing that `itemId = 101` occurs 200,000 times.

Of course, the database doesn't necessarily maintain an exact row count for every distinct value in this format.

That would be impractical for columns with millions of distinct values.

Instead, database engines use techniques such as histograms and density information to represent the data distribution.

### Understanding Histograms

A histogram is essentially a summarized representation of how values are distributed in a column.

Let's imagine the following distribution:

```text
Number of rows
     |
200K |       █
     |       █
     |       █
     |       █
     |       █
     |       █
  5K |       █                 █   █
     |       █                 █   █
     |       █                 █   █
   0 +--------------------------------
           101   102   103   104
```

The important observation is that `101` is significantly more frequent than the other values.

The database uses statistics to maintain an approximation of this distribution.

In SQL Server, for example, a histogram is maintained for the first column of a statistics object. It contains up to 200 steps, with information such as the range of values and their estimated frequency.

This means the histogram doesn't necessarily contain an individual entry for every distinct value.

It is a summary of the distribution.

Also, statistics can be created using sampled data or a full scan. They are not necessarily updated every time a row is inserted or deleted.

The exact details vary across database engines, but the underlying idea is the same:

**The database maintains information about the data so that it can make better decisions without having to scan the entire table every time.**

## How Statistics Influence the Query Plan

Now that we understand statistics, let's connect them with the query execution process.

When we submit a SQL query, the database doesn't immediately start reading rows.

There is an optimization phase.

The database examines the query, available indexes, schema information, constraints, and statistics to determine how it should execute the query.

It estimates the cost of different possible execution strategies and chooses a plan based on those estimates.

This plan is called a **Query Execution Plan**.

For our earlier query:

```sql
SELECT *
FROM Orders
WHERE itemId = 102;
```

The database might consider multiple alternatives.

**Plan A:**

```text
Index Seek
    |
Key Lookup
    |
Return Rows
```

**Plan B:**

```text
Clustered Index Scan
    |
Filter itemId = 102
    |
Return Rows
```

Based on the statistics, the database estimates that only a small number of rows will match `itemId = 102`.

Therefore, Plan A is likely to be cheaper.

For `itemId = 101`, the estimate is considerably higher, so Plan B might be a better choice.

The important thing to understand is that statistics influence the database's estimate of how much work each plan will perform.

They don't directly tell the database which plan to choose. The optimizer uses those estimates, along with its cost model, to make that decision.

### Estimated Rows vs Actual Rows

There is one more concept worth understanding here.

When the database creates a query plan, it estimates how many rows each operation will process.

These are called **Estimated Rows**.

Once the query executes, the actual number of rows processed can be different.

These are called **Actual Rows**.

For example:

| Metric | Number of rows |
| :--- | ---: |
| Estimated Rows | 10 |
| Actual Rows | 200,000 |

Imagine the optimizer expected only 10 rows, so it chose an index seek followed by key lookups.

But the query actually returned 200,000 rows.

The plan might turn out to be much more expensive than expected.

This is one reason why looking at the actual execution plan is useful when investigating slow queries.

A significant difference between estimated and actual rows can indicate that the optimizer's assumptions about the data were incorrect.

It doesn't automatically mean statistics are stale, though. Incorrect estimates can also result from correlated columns, complex predicates, parameter values, and limitations in the optimizer's estimation model.

## Why Does the Database Cache Query Plans?

So far, we have discussed how the database analyzes a query and chooses an execution plan.

But there is another optimization.

Imagine an application executing the same query thousands of times every day.

It would be wasteful to go through the entire optimization process every single time if the query and its execution context haven't changed.

So, database engines such as SQL Server can cache execution plans.

The next time a compatible query is executed, the database can reuse the cached plan instead of compiling a new one.

This saves the cost of repeatedly optimizing the same query.

However, there is an interesting problem with this approach.

### Parameter Sniffing

Remember our stored procedure?

```sql
CREATE PROCEDURE getOrdersByItemId
    @itemId_param INT
AS
BEGIN
    SELECT *
    FROM Orders
    WHERE itemId = @itemId_param;
END;
```

We know that:

- `itemId = 101` returns 200,000 rows.
- `itemId = 102` returns only 10 rows.

Let's say the first time this stored procedure is executed, the parameter value is `102`.

During compilation, SQL Server can use this parameter value to estimate the number of matching rows.

Since only a few rows are expected, it might choose:

```text
Non-Clustered Index Seek
          |
       Key Lookup
          |
      Return Rows
```

The execution plan is then cached.

Now, suppose the application executes the same stored procedure with `itemId = 101`.

The database might reuse the previously cached plan.

But this time, instead of 10 rows, we need to retrieve 200,000 rows.

The previously selected plan might no longer be efficient.

This behavior is related to something called **Parameter Sniffing**.

Parameter sniffing is not inherently bad. In fact, using the parameter value during compilation often helps the optimizer choose a better plan.

The problem occurs when the plan compiled for one parameter value is reused for another parameter value with a significantly different data distribution.

This is one of those situations where a query can perform perfectly fine for one set of inputs and become unexpectedly slow for another.

There are ways to handle this, such as recompiling queries, using appropriate query hints, or designing queries differently. But those are topics worth exploring separately.

## What Happens When Statistics Become Stale?

There is one final piece to this discussion.

Statistics are not necessarily updated every time the underlying data changes.

Imagine that when statistics were last collected, our table looked something like this:

| itemId | Number of rows |
| :--- | ---: |
| 101 | 200,000 |
| 102 | 10 |

Now, suppose the application performs a large batch of inserts and updates.

The distribution changes significantly:

| itemId | Number of rows |
| :--- | ---: |
| 101 | 10 |
| 102 | 200,000 |

But the database is still working with statistics that describe the older distribution.

When the optimizer sees a query for `itemId = 102`, it might estimate that only 10 rows will match, even though the actual number is now 200,000.

As we saw earlier, this can result in an unsuitable execution plan.

This is why keeping statistics reasonably up to date matters.

Database engines such as SQL Server support automatic statistics updates, and statistics can also be updated manually.

However, automatic updates are not necessarily triggered after every data modification. The timing depends on factors such as modification thresholds and database configuration.

This is particularly important for tables with frequent writes or highly changing data distributions.

## Bringing It All Together

Let's take a step back and connect everything we have discussed.

When a query is submitted, the database needs to figure out how to execute it.

It considers the available indexes, schema, query structure, and statistics.

Based on this information, the optimizer estimates the amount of work involved in different execution strategies and selects a query plan.

That plan can then be cached and reused for subsequent executions.

The overall process looks something like this:

```text
             SQL Query
                 |
                 v
        Query Optimization
                 |
                 v
    Examine indexes, schema and
             statistics
                 |
                 v
    Estimate rows and execution
                costs
                 |
                 v
     Choose an execution plan
                 |
                 v
          Cache the plan
                 |
                 v
          Execute the query
                 |
                 v
           Return results
```

The thing I find particularly interesting here is that an index is not automatically a performance improvement.

An index gives the database another way to access data. Whether that access path is useful depends on how much data needs to be retrieved and how expensive it is to retrieve it.

And that's where statistics and query plans become important.
