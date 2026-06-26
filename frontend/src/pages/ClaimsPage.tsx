import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import ClaimsTable from '../components/tables/ClaimsTable';
import ClaimFilters from '../components/tables/ClaimFilters';
import { useStore } from '../store/useStore';

export default function ClaimsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { scrollMode } = useStore();

  const getParam = (key: string, fallback = '') => searchParams.get(key) || fallback;

  const [infiniteRows, setInfiniteRows] = React.useState<any[]>([]);
  const [infinitePage, setInfinitePageState] = React.useState(1);

  const page = parseInt(getParam('page', '1'));
  const sortBy = getParam('sortBy', 'sfCreatedDate');
  const sortDir = (getParam('sortDir', 'desc') || 'desc') as 'asc' | 'desc';

  const filters = {
    search: getParam('search'),
    status: getParam('status'),
    dealer: getParam('dealer'),
    assignee: getParam('assignee'),
    owner: getParam('owner'),
    dateFrom: getParam('dateFrom'),
    dateTo: getParam('dateTo'),
    hasHQProduct: getParam('hasHQProduct'),
    hasFinancialOrder: getParam('hasFinancialOrder'),
    hasBillingDocument: getParam('hasBillingDocument'),
    limit: parseInt(getParam('limit', '20')),
  };

  const queryParams = {
    page: scrollMode === 'infinite' ? infinitePage : page,
    ...filters,
    sortBy,
    sortDir,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['claims', queryParams],
    queryFn: () => api.getClaims(queryParams as any),
    placeholderData: prev => prev,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['claims', 'filter-options'],
    queryFn: api.getFilterOptions,
    staleTime: 10 * 60 * 1000,
  });

  // Sync URL params from Insights chart navigation
  React.useEffect(() => {
    // no-op: filters read directly from URL
  }, [searchParams]);

  // Merge infinite scroll rows
  React.useEffect(() => {
    if (scrollMode !== 'infinite' || !data?.data) return;
    if (infinitePage === 1) setInfiniteRows(data.data);
    else setInfiniteRows(prev => [...prev, ...data.data]);
  }, [data, scrollMode, infinitePage]);

  // Reset infinite scroll on filter/sort change
  React.useEffect(() => {
    if (scrollMode === 'infinite') {
      setInfiniteRows([]);
      setInfinitePageState(1);
    }
  }, [searchParams, scrollMode]);

  // Direct URL update — called on every filter change (no staging)
  const handleFilterChange = useCallback((partial: Record<string, any>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(partial)) {
        if (v === '' || v === undefined || v === null) next.delete(k);
        else next.set(k, String(v));
      }
      next.set('page', '1');
      next.set('sortBy', sortBy);
      next.set('sortDir', sortDir);
      return next;
    }, { replace: false });
  }, [setSearchParams, sortBy, sortDir]);

  const clearFilters = useCallback(() => {
    setSearchParams({ sortBy, sortDir }, { replace: false });
  }, [setSearchParams, sortBy, sortDir]);

  const handleSort = useCallback((field: string) => {
    const newDir = sortBy === field && sortDir === 'desc' ? 'asc' : 'desc';
    setSearchParams(p => {
      const next = new URLSearchParams(p);
      next.set('sortBy', field);
      next.set('sortDir', newDir);
      next.set('page', '1');
      return next;
    }, { replace: false });
  }, [sortBy, sortDir, setSearchParams]);

  const handlePageChange = useCallback((p: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  const loadMore = useCallback(() => {
    if (!isFetching) setInfinitePageState(p => p + 1);
  }, [isFetching]);

  const hasNextPage = scrollMode === 'infinite'
    ? infiniteRows.length < (data?.total ?? 0)
    : false;

  const displayData = scrollMode === 'infinite'
    ? { data: infiniteRows, total: data?.total ?? 0, page: 1, limit: filters.limit, totalPages: 1 }
    : data;

  return (
    <div className="space-y-4 animate-slide-up">
      <ClaimFilters
        filters={filters}
        options={filterOptions || { statuses: [], dealers: [], assignees: [], owners: [] }}
        onChange={handleFilterChange}
        onClear={clearFilters}
        totalCount={data?.total ?? 0}
      />

      <ClaimsTable
        data={displayData}
        loading={isLoading}
        isFetchingMore={isFetching && scrollMode === 'infinite'}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        page={page}
        onPageChange={handlePageChange}
        onLoadMore={loadMore}
        hasNextPage={hasNextPage}
      />
    </div>
  );
}
