import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import ClaimsTable from '../components/tables/ClaimsTable';
import ClaimFilters from '../components/tables/ClaimFilters';
import { useStore } from '../store/useStore';

const DEFAULTS = {
  search: '', status: '', dealer: '', model: '',
  dateFrom: '', dateTo: '', hasHQProduct: '', limit: 20,
};

export default function ClaimsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { scrollMode } = useStore();

  // Derive filter state from URL
  const getParam = (key: string, fallback = '') => searchParams.get(key) || fallback;
  const [staged, setStaged] = useState({
    search: getParam('search'),
    status: getParam('status'),
    dealer: getParam('dealer'),
    model: getParam('model'),
    dateFrom: getParam('dateFrom'),
    dateTo: getParam('dateTo'),
    hasHQProduct: getParam('hasHQProduct'),
    limit: parseInt(getParam('limit', '20')),
  });

  const [infiniteRows, setInfiniteRows] = useState<any[]>([]);
  const [infinitePage, setInfinitePage] = useState(1);

  const page = parseInt(getParam('page', '1'));
  const sortBy = getParam('sortBy', 'sfCreatedDate');
  const sortDir = (getParam('sortDir', 'desc') || 'desc') as 'asc' | 'desc';

  const queryParams = {
    page: scrollMode === 'infinite' ? infinitePage : page,
    limit: staged.limit,
    search: getParam('search'),
    status: getParam('status'),
    dealer: getParam('dealer'),
    model: getParam('model'),
    dateFrom: getParam('dateFrom'),
    dateTo: getParam('dateTo'),
    hasHQProduct: getParam('hasHQProduct'),
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
      setInfinitePage(1);
    }
  }, [searchParams, scrollMode]);

  const applyFilters = useCallback(() => {
    const params: Record<string, string> = {};
    if (staged.search) params.search = staged.search;
    if (staged.status) params.status = staged.status;
    if (staged.dealer) params.dealer = staged.dealer;
    if (staged.model) params.model = staged.model;
    if (staged.dateFrom) params.dateFrom = staged.dateFrom;
    if (staged.dateTo) params.dateTo = staged.dateTo;
    if (staged.hasHQProduct) params.hasHQProduct = staged.hasHQProduct;
    if (staged.limit !== 20) params.limit = String(staged.limit);
    params.sortBy = sortBy;
    params.sortDir = sortDir;
    setSearchParams(params, { replace: false });
  }, [staged, sortBy, sortDir, setSearchParams]);

  const clearFilters = useCallback(() => {
    setStaged(DEFAULTS);
    setSearchParams({}, { replace: false });
  }, [setSearchParams]);

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
    if (!isFetching) setInfinitePage(p => p + 1);
  }, [isFetching]);

  const hasNextPage = scrollMode === 'infinite'
    ? infiniteRows.length < (data?.total ?? 0)
    : false;

  const displayData = scrollMode === 'infinite'
    ? { data: infiniteRows, total: data?.total ?? 0, page: 1, limit: staged.limit, totalPages: 1 }
    : data;

  return (
    <div className="space-y-4 animate-slide-up">
      <ClaimFilters
        filters={staged}
        options={filterOptions || { statuses: [], dealers: [], models: [] }}
        onChange={v => setStaged(s => ({ ...s, ...v }))}
        onApply={applyFilters}
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
