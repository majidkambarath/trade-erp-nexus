import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus,
  Download,
  RefreshCw,
  Tag,
  Edit3,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { pageSession } from "../../lib/pageSession";
import { useListView } from "../../lib/useListView";
import StatCard from "../ui/stat-card";
import { Button } from "../ui/button";
import ListPage from "../lists/ListPage";
import ListPager from "../lists/ListPager";
import { pageFigures } from "../../lib/pagination";

import { downloadCSV, formatTime } from "../../utils/format";
import { ConfirmDialog, Field, Modal, Pill, Select, TextInput, Textarea, useAsync, useToasts } from "../accounting/kit";
import Can from "../shell/Can";

// What this screen keeps while the person visits another page and comes back (lib/pageSession.js): the search (via
// useListView, below), and a half-filled new-category form. Held in memory for the tab; emptied at sign-out.
const PAGE_NAME = "inventory-categories";
const session = pageSession(PAGE_NAME);

const blankForm = () => ({ name: "", description: "", status: "Active" });
// a form is worth keeping once the person has put something in it ("Active" is where it starts, not an entry)
const hasEntry = (draft) => Boolean(draft && (draft.name || draft.description || (draft.status && draft.status !== "Active")));

const CategoryManagement = () => {
  // search/filters/sort/selection for this list - lib/useListView.js. No filters or sort of its own today
  // (a category has only a name, a description and a status, and the server has nothing to sort on), so
  // this is mostly the search box; it is the first real screen to adopt the `ListPage`/`useListView` shell
  // built for Stage 1c, in place of the hand-rolled search state every list used to carry on its own.
  const list = useListView(PAGE_NAME, {});
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(null);
  // the half-filled new-category form comes back as the person left them
  const [restoredDraft] = useState(() => {
    const draft = session.get("formData");
    return hasEntry(draft) ? { ...blankForm(), ...draft } : null;
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState({
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0,
  });
  const [formData, setFormData] = useState(() => restoredDraft || blankForm());
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify, toastNode } = useToasts();
  const [isDraftSaved, setIsDraftSaved] = useState(() => Boolean(restoredDraft));
  const [lastSaveTime, setLastSaveTime] = useState(() => (restoredDraft ? session.get("lastSaveTime") : null));
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    categoryId: null,
    categoryName: "",
    isDeleting: false,
  });

  const formRef = useRef(null);

  // What is actually SENT to the server: the box (list.search) updates on every key, this waits for a pause - except
  // when the box goes back to empty (backspaced, or "Clear filters"/"Clear search and filters" pressed), which asks
  // again at once rather than making someone wait to see the full list come back.
  const [askedSearch, setAskedSearch] = useState(() => (list.search || "").trim());
  useEffect(() => {
    if (!list.search) { setAskedSearch(""); return undefined; }
    const t = setTimeout(() => setAskedSearch(list.search.trim()), 300);
    return () => clearTimeout(t);
  }, [list.search]);

  // Only the NEW-category form is kept: an edit is a change to a record the server holds, and kept as a draft it would come back
  // as a new category carrying another one's details. It is written at once (leaving the page inside the two seconds below must
  // not lose it); the two seconds only decide when the form says "saved".
  useEffect(() => {
    if (!showModal || isEditMode || !hasEntry(formData)) return undefined;
    const at = new Date().toISOString();
    session.set("formData", formData);
    session.set("lastSaveTime", at);
    const t = setTimeout(() => {
      setIsDraftSaved(true);
      setLastSaveTime(at);
    }, 2000);
    return () => clearTimeout(t);
  }, [formData, showModal, isEditMode]);

  // Every existing call site below reads `showToastMessage(message, type)` - kept as a thin wrapper over the
  // shared kit.useToasts() so none of them needed to change.
  const showToastMessage = useCallback((message, type = "success") => notify(message, type), [notify]);

  // What the answer in hand actually answers, vs. what the screen is asking right now - these can differ for one
  // render: a page clamped back after a delete (the effect below) takes effect before its own refetch lands, and
  // without this check the empty state would flash onto a request that was never actually made.
  const asking = `${page}|${askedSearch}|${pageSize}`;
  const { data, loading, error, reload } = useAsync(
    () =>
      axiosInstance.get("/categories/categories", { params: { page, limit: pageSize, search: askedSearch || undefined } }).then((response) => ({
        categories: response.data.data?.categories || [],
        totalPages: response.data.totalPages || 1,
        total: Number(response.data.total) || 0,
        answeredFor: asking,
      })),
    [page, pageSize, askedSearch]
  );
  const categories = useMemo(() => data?.categories || [], [data]);
  const totalPages = data?.totalPages || 1;
  const totalRows = data?.total || 0;
  const answered = data?.answeredFor === asking;

  // the same guarantee the hand-rolled fetch used to give directly: a failed list request still says so
  useEffect(() => {
    if (error) showToastMessage(error.response?.data?.message || "Failed to fetch categories", "error");
  }, [error, showToastMessage]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/categories/categories/stats");
      setStats(
        response.data.data?.stats || {
          totalCategories: 0,
          activeCategories: 0,
          inactiveCategories: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching stats:", error);
      showToastMessage("Failed to fetch statistics", "error");
    }
  }, [showToastMessage]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // a new search starts at the first page, and a page that no longer exists (the last row of the last page was deleted) falls back
  // to the last one, so the list is never "empty" while the categories are on another page
  useEffect(() => {
    setPage(1);
  }, [askedSearch]);
  useEffect(() => {
    if (!loading && page > totalPages) setPage(Math.max(1, totalPages));
  }, [loading, page, totalPages]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      setIsDraftSaved(false);
    },
    [errors]
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name) newErrors.name = "Category name is required";
    if (formData.description.length > 500)
      newErrors.description = "Description cannot exceed 500 characters";
    return newErrors;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(blankForm());
    setErrors({});
    setShowModal(false);
    setIsEditMode(false);
    setEditCategoryId(null);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    session.remove("formData");
    session.remove("lastSaveTime");
  }, []);

  const handleSubmit = useCallback(async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await axiosInstance.put(`/categories/categories/${editCategoryId}`, formData);
        showToastMessage("Category updated successfully!", "success");
      } else {
        await axiosInstance.post("/categories/categories", formData);
        showToastMessage("Category created successfully!", "success");
      }
      resetForm();
      reload();
      fetchStats();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || `Failed to ${isEditMode ? "update" : "create"} category`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, resetForm, isEditMode, editCategoryId, reload, fetchStats, showToastMessage]);

  const handleEdit = useCallback((category) => {
    setFormData({
      name: category.name,
      description: category.description || "",
      status: category.status,
    });
    setEditCategoryId(category._id);
    setIsEditMode(true);
    setShowModal(true);
    setTimeout(() => {
      if (formRef.current) {
        const firstInput = formRef.current.querySelector('input[name="name"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, []);

  const showDeleteConfirmation = useCallback((categoryId, categoryName) => {
    setDeleteConfirmation({
      visible: true,
      categoryId,
      categoryName,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      categoryId: null,
      categoryName: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/categories/categories/${deleteConfirmation.categoryId}`);
      showToastMessage("Category deleted successfully!", "success");
      reload();
      fetchStats();
      hideDeleteConfirmation();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete category",
        "error"
      );
    } finally {
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteConfirmation.categoryId, reload, fetchStats, showToastMessage, hideDeleteConfirmation]);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return formatTime(time);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      // the shared exporter: it quotes cells and makes a name that begins with = + - @ text, not a formula
      downloadCSV(
        "categories_export.csv",
        ["CategoryID", "Name", "Description", "Status", "CreatedAt"],
        categories.map((c) => [c._id, c.name, c.description || "", c.status, c.createdAt])
      );

      showToastMessage("Categories exported successfully!", "success");
    } catch {
      showToastMessage("Failed to export data", "error");
    }
  }, [categories, showToastMessage]);

  const handleRefresh = useCallback(() => {
    reload();
    fetchStats();
    showToastMessage("Data refreshed successfully!", "success");
  }, [reload, fetchStats, showToastMessage]);

  // what the list on the screen was actually asked for: the empty state's wording follows this, not the search
  // box, which can be ahead of it by the debounce above. Guarded by `page <= totalPages` too: a delete that empties
  // the last page must show the page before it (the clamp effect above), never an empty-state flash in between.
  const listFiltered = Boolean(askedSearch);
  // `false`, not `null` - ListPage's own `empty ?? (its default text)` would read a bare `null` as "nothing
  // custom was given" and substitute ITS OWN "No categories yet"/"No categories match" copy; `false` is not
  // nullish, so it suppresses the empty state outright, exactly while the guard below says the answer in
  // hand does not (yet) answer what the screen is asking.
  const emptyNode =
    !answered || page > totalPages ? false : (
      <div className="text-center py-12">
        <Tag size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-foreground">
          {listFiltered ? "No categories match the search or filters" : "No categories yet"}
        </p>
        <p className="text-muted-foreground text-sm">
          {listFiltered ? (
            "Clear the search to see every category."
          ) : (
            <Can permission="inventory.create" fallback="Categories your team adds will be listed here.">
              Add a category to start the list.
            </Can>
          )}
        </p>
        {listFiltered && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={list.clearFilters} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent">
              Clear search and filters
            </button>
          </div>
        )}
      </div>
    );

  return (
    <>
      <ListPage
        title="Category Management"
        description={`${stats.totalCategories} total categories • ${categories.length} displayed`}
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="Export to CSV"
              aria-label="Export to CSV"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <Can permission="inventory.create">
              <Button
                data-shortcut="new"
                onClick={() => {
                  setShowModal(true);
                  setIsEditMode(false);
                  setEditCategoryId(null);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Category
              </Button>
            </Can>
          </>
        }
        beforeFilters={
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 mb-8">
            {[
              { title: "Total Categories", count: stats.totalCategories, icon: <Tag size={24} /> },
              { title: "Active Categories", count: stats.activeCategories, icon: <CheckCircle2 size={24} /> },
              { title: "Inactive Categories", count: stats.inactiveCategories, icon: <XCircle size={24} /> },
            ].map((card, index) => (
              <StatCard
                key={index}
                title={card.title}
                count={card.count}
                icon={card.icon}
                tone={["teal", "plum", "olive", "rose"][index % 4]}
              />
            ))}
          </div>
        }
        list={list}
        noun="categories"
        searchLabel="Search categories"
        placeholder="Search name or description…"
        caption="Categories"
        rows={categories}
        rowKey={(category) => category._id}
        columns={[
          {
            key: "name", header: "Category Name", card: "primary",
            cell: (category) => (
              <div className="flex items-center space-x-3">
                <div className="rounded-lg bg-secondary p-2">
                  <Tag size={16} className="text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">{category.name}</p>
              </div>
            ),
          },
          { key: "description", header: "Description", card: "title", cell: (category) => <p className="text-sm text-muted-foreground">{category.description || "No description"}</p> },
          {
            key: "status", header: "Status", card: "badge",
            cell: (category) => <Pill tone={category.status === "Active" ? "success" : "danger"}>{category.status}</Pill>,
          },
          {
            key: "actions", header: "Actions", align: "center", card: "actions",
            cell: (category) => (
              <div className="flex justify-center space-x-2">
                <Can permission="inventory.edit"><button onClick={() => handleEdit(category)} className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground lg:h-8 lg:w-8" title="Edit Category"><Edit3 size={16} /></button></Can>
                <Can permission="inventory.delete"><button onClick={() => showDeleteConfirmation(category._id, category.name)} className="grid h-10 w-10 place-items-center rounded-lg text-status-danger transition-colors duration-200 hover:bg-status-danger-soft lg:h-8 lg:w-8" title="Delete Category"><Trash2 size={16} /></button></Can>
              </div>
            ),
          },
        ]}
        loading={loading}
        loadingLabel="Loading categories"
        error={error}
        onRetry={reload}
        empty={emptyNode}
        pager={
          categories.length > 0 ? (
            <ListPager
              figures={pageFigures({ page, size: pageSize, total: totalRows })}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              noun="categories"
              one="category"
              className="rounded-none border-0 border-t shadow-none"
            />
          ) : null
        }
      />

      {showModal && (
        <Modal
          size="lg"
          title={isEditMode ? "Edit Category" : "Add Category"}
          description={isEditMode ? "Update an existing inventory category" : "Create a new inventory category"}
          onClose={resetForm}
          footer={
            <>
              <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {isSubmitting ? (isEditMode ? "Updating..." : "Creating...") : isEditMode ? "Update Category" : "Create Category"}
              </Button>
            </>
          }
        >
          <div className="grid gap-4" ref={formRef}>
            {/* a new category is kept as a draft; an edit is not (nothing is saved until Update) */}
            {!isEditMode && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {isDraftSaved && lastSaveTime && (
                  <span className="flex items-center text-status-success">
                    <CheckCircle2 size={12} className="mr-1" aria-hidden="true" />
                    Draft saved {formatLastSaveTime(lastSaveTime)}
                  </span>
                )}
                {isDraftSaved ? (
                  <span className="flex items-center text-status-success">
                    <CheckCircle2 size={14} className="mr-1" aria-hidden="true" />
                    Changes saved automatically
                  </span>
                ) : formData.name || formData.description ? (
                  <span className="flex items-center text-status-warning">
                    <AlertCircle size={14} className="mr-1" aria-hidden="true" />
                    Unsaved changes
                  </span>
                ) : null}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category Name" required error={errors.name}>
                <TextInput data-autofocus name="name" value={formData.name} onChange={handleChange} placeholder="Enter category name" />
              </Field>
              <Field label="Status">
                <Select name="status" value={formData.status} onChange={handleChange}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </Field>
            </div>

            <Field label="Description" error={errors.description}>
              <Textarea name="description" value={formData.description} onChange={handleChange} placeholder="Optional description..." rows={4} />
            </Field>
          </div>
        </Modal>
      )}

      {deleteConfirmation.visible && (
        <ConfirmDialog
          title="Delete Category"
          text={`Are you sure you want to delete "${deleteConfirmation.categoryName}"? This action cannot be undone and will permanently remove the category from your inventory.`}
          confirmLabel="Delete"
          danger
          busy={deleteConfirmation.isDeleting}
          onClose={hideDeleteConfirmation}
          onConfirm={confirmDelete}
        />
      )}

      {toastNode}
    </>
  );
};

export default CategoryManagement;
