"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { UUID_PATTERN } from "@/lib/approval-policy";
import Link from "next/link";
import styles from "./admin.module.css";

const ProofPortal = dynamic(() => import("@/components/approvals/ProofPortal"), { ssr: false });

interface OrderItem {
  id: string;
  productType: string;
  material?: string;
  shape?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  designFileUrl?: string;
  size: { label?: string; name?: string };
}

interface Order {
  id: string;
  track_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  order_notes?: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
}

interface Post {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  status: string;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"orders" | "posts" | "approvals">("orders");
  const [approvalOrderId, setApprovalOrderId] = useState<string | undefined>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [postStatusFilter, setPostStatusFilter] = useState("pending");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");

  const approvalOrders = useMemo(
    () => orders.map(({ id, track_id, customer_name, customer_email, status }) => ({
      id, track_id, customer_name, customer_email, status,
    })),
    [orders],
  );

  const openApprovals = (id?: string) => {
    setApprovalOrderId(id);
    setSelectedOrder(null);
    setActiveTab("approvals");
  };

  const showToast = (msg: string) => {
    setAlertMessage(msg);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load orders. Sign in again if your session expired.");
      setOrdersError("");
      setOrders(data.orders || []);
    } catch (error) {
      setOrders([]);
      setOrdersError(error instanceof Error ? error.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      console.error("Failed to fetch posts");
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("adminToken")) {
      setIsAuthenticated(true);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "approvals") {
      setActiveTab("approvals");
      const orderId = params.get("order");
      if (orderId && UUID_PATTERN.test(orderId)) setApprovalOrderId(orderId);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
      fetchPosts();
    }
  }, [isAuthenticated, fetchOrders, fetchPosts]);

  const filteredOrders = useMemo(() => {
    if (!statusFilter) return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const filteredPosts = useMemo(() => {
    if (!postStatusFilter) return posts;
    return posts.filter((p) => p.status === postStatusFilter);
  }, [posts, postStatusFilter]);

  const pendingOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const completedOrders = orders.filter((o) => o.status === "delivered").length;
  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + parseFloat(String(o.total)), 0)
    .toFixed(2);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setLoginError("");
        setPassword("");
        localStorage.setItem("adminToken", data.token);
      } else {
        setLoginError("Invalid password. Please try again.");
      }
    } catch {
      setLoginError("Login failed. Please try again.");
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setLoginError("");
    localStorage.removeItem("adminToken");
  };

  const updateOrderStatus = async (order: Order, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: data.order.status } : o)));
        showToast(`Order status updated to: ${data.order.status}`);
      } else {
        showToast(data.error || "Failed to update order status.");
      }
    } catch {
      showToast("Error updating order status.");
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        alert(`Order ${orderId} deleted successfully.`);
      } else {
        alert(data.error || "Failed to delete order.");
      }
    } catch {
      alert("There was an error deleting this order. Please try again.");
    }
  };

  const saveDescription = async (post: Post) => {
    const newDesc = editDescription.trim();
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, description: newDesc } : p)));
    setEditingPostId(null);
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: newDesc }),
    });
  };

  const reviewPost = async (id: string, status: "approved" | "denied") => {
    try {
      const res = await fetch("/api/posts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update this post.");
      setPosts((prev) => prev.map((post) => post.id === id ? { ...post, status } : post));
      showToast(status === "approved" ? "Post approved successfully!" : "Post denied.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update this post.");
    }
  };

  const handleApprove = (id: string) => reviewPost(id, "approved");
  const handleDeny = (id: string) => reviewPost(id, "denied");

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  if (!isAuthenticated) {
    return (
      <div className={styles["admin-container"]}>
        <div className={styles["login-section"]}>
          <div className={styles["login-card"]}>
            <div className={styles["logo-section"]}>
              <Image src="/logo.png" alt="ELEV8 PRINT" className={styles.logo} width={70} height={70} />
              <h1>Admin Portal</h1>
              <p className={styles["login-subtitle"]}>Secure access to order management</p>
            </div>
            <form onSubmit={handleLogin} className={styles["login-form"]}>
              <div className={styles["form-group"]}>
                <label htmlFor="password">Admin Password</label>
                <div className={styles["input-wrapper"]}>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    required
                    className={styles["password-input"]}
                  />
                </div>
              </div>
              <button type="submit" className={styles["login-btn"]} disabled={!password}>
                <span className={styles["btn-text"]}>Login to Admin Panel</span>
              </button>
              {loginError && (
                <div className={styles["error-message"]}>
                  <span className={styles["error-icon"]}>⚠</span>
                  {loginError}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["admin-container"]}>
      {showAlert && (
        <div className={styles["success-alert"]}>
          <div className={styles["alert-content"]}>
            <span className={styles["alert-icon"]}>✓</span>
            <span className={styles["alert-message"]}>{alertMessage}</span>
          </div>
        </div>
      )}

      <div className={styles["admin-dashboard"]}>
        <div className={styles["dashboard-header"]}>
          <div className={styles["header-content"]}>
            <h1>Admin Dashboard</h1>
            <p className={styles["header-subtitle"]}>Manage orders and review posts</p>
          </div>
          <button type="button" onClick={logout} className={styles["logout-btn"]}>Logout</button>
        </div>

        <div className={styles["tab-navigation"]}>
          <button type="button" onClick={() => setActiveTab("orders")} className={`${styles["tab-btn"]} ${activeTab === "orders" ? styles.active : ""}`}>📦 Orders</button>
          <button type="button" onClick={() => setActiveTab("posts")} className={`${styles["tab-btn"]} ${activeTab === "posts" ? styles.active : ""}`}>📝 Posts Review</button>
          <button type="button" onClick={() => openApprovals()} className={`${styles["tab-btn"]} ${activeTab === "approvals" ? styles.active : ""}`}>Artwork Approvals</button>
        </div>

        {activeTab === "orders" && (
          <div className={styles["orders-view"]}>
            <div className={styles["stats-grid"]}>
              <div className={`${styles["stat-card"]} ${styles["total-orders"]}`}>
                <div className={styles["stat-icon"]}>📦</div>
                <div className={styles["stat-content"]}>
                  <h3>Total Orders</h3>
                  <div className={styles["stat-number"]}>{orders.length}</div>
                </div>
              </div>
              <div className={`${styles["stat-card"]} ${styles["pending-orders"]}`}>
                <div className={styles["stat-icon"]}>⏳</div>
                <div className={styles["stat-content"]}>
                  <h3>Pending Orders</h3>
                  <div className={styles["stat-number"]}>{pendingOrders}</div>
                </div>
              </div>
              <div className={`${styles["stat-card"]} ${styles["completed-orders"]}`}>
                <div className={styles["stat-icon"]}>✅</div>
                <div className={styles["stat-content"]}>
                  <h3>Completed Orders</h3>
                  <div className={styles["stat-number"]}>{completedOrders}</div>
                </div>
              </div>
              <div className={`${styles["stat-card"]} ${styles.revenue}`}>
                <div className={styles["stat-icon"]}>💰</div>
                <div className={styles["stat-content"]}>
                  <h3>Total Revenue</h3>
                  <div className={styles["stat-number"]}>${totalRevenue}</div>
                </div>
              </div>
            </div>

            <div className={styles["orders-section"]}>
              <div className={styles["section-header"]}>
                <div className={styles["section-title"]}>
                  <h2>Recent Orders</h2>
                  <span className={styles["order-count"]}>{filteredOrders.length} orders</span>
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles["filter-select"]}>
                  <option value="">All Status</option>
                  <option value="received">Received</option>
                  <option value="processing">Processing</option>
                  <option value="producing">Producing</option>
                  <option value="qc_check">QC Check</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              {ordersError ? <p role="alert">{ordersError}</p> : null}
              {loading ? (
                <div className={styles["loading-state"]}>Loading orders...</div>
              ) : (
                <div className={styles["orders-table"]}>
                  <div className={styles["table-header"]}>
                    <div className={styles["col-id"]}>Order ID</div>
                    <div className={styles["col-customer"]}>Customer</div>
                    <div className={styles["col-items"]}>Items</div>
                    <div className={styles["col-total"]}>Total</div>
                    <div className={styles["col-status"]}>Status</div>
                    <div className={styles["col-date"]}>Date</div>
                    <div className={styles["col-actions"]}>Actions</div>
                  </div>
                  {filteredOrders.map((order) => (
                    <div key={order.id} className={styles["table-row"]}>
                      <div className={styles["col-id"]}>
                        <span className={styles["order-id"]}>#{order.track_id}</span>
                      </div>
                      <div className={styles["col-customer"]}>
                        <div className={styles["customer-info"]}>
                          <div className={styles["customer-name"]}>{order.customer_name}</div>
                          <div className={styles["customer-email"]}>{order.customer_email}</div>
                        </div>
                      </div>
                      <div className={styles["col-items"]}>
                        <div className={styles["items-count"]}>{order.items.length} item(s)</div>
                      </div>
                      <div className={styles["col-total"]}>
                        <span className={styles["total-amount"]}>${order.total.toFixed(2)}</span>
                      </div>
                      <div className={styles["col-status"]}>
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order, e.target.value)}
                          className={`${styles["status-select"]} ${styles[`status-${order.status}`] || ""}`}
                        >
                          <option value="received">Received</option>
                          <option value="processing">Processing</option>
                          <option value="producing">Producing</option>
                          <option value="qc_check">QC Check</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div className={styles["col-date"]}>{formatDate(order.created_at)}</div>
                      <div className={styles["col-actions"]}>
                        <button type="button" onClick={() => setSelectedOrder(order)} className={`${styles["action-btn"]} ${styles["view-btn"]}`}>View</button>
                        <button type="button" onClick={() => openApprovals(order.id)} className={`${styles["action-btn"]} ${styles["view-btn"]}`}>Artwork</button>
                        <button type="button" onClick={() => deleteOrder(order.id)} className={`${styles["action-btn"]} ${styles["delete-btn"]}`}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "approvals" && (
          <ProofPortal staff websiteOrders={approvalOrders} selectedOrderId={approvalOrderId} />
        )}

        {activeTab === "posts" && (
          <div className={styles["posts-view"]}>
            <div className={styles["posts-section"]}>
              <div className={styles["section-header"]}>
                <div className={styles["section-title"]}>
                  <h2>Post Review</h2>
                  <span className={styles["order-count"]}>{filteredPosts.length} posts</span>
                </div>
                <div className={styles["post-filters"]}>
                  {[
                    { value: "pending", label: "⏳ Pending" },
                    { value: "", label: "📋 All Posts" },
                    { value: "approved", label: "✅ Approved" },
                    { value: "denied", label: "❌ Denied" },
                  ].map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => setPostStatusFilter(f.value)}
                      className={`${styles["filter-btn"]} ${postStatusFilter === f.value ? styles.active : ""}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingPosts ? (
                <div className={styles["loading-state"]}>Loading posts...</div>
              ) : filteredPosts.length === 0 ? (
                <div className={styles["empty-state"]}>No posts found.</div>
              ) : (
                <div className={styles["post-grid"]}>
                  {filteredPosts.map((post) => (
                    <div key={post.id} className={styles["post-card"]}>
                      {(post.status === "approved" || post.status === "denied") && (
                        <div className={`${styles["status-overlay"]} ${styles[post.status]}`} />
                      )}
                      {post.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.image_url}
                          className={styles["post-image"]}
                          onClick={() => setSelectedImage(post.image_url!)}
                          alt="Post"
                        />
                      )}
                      <div className={styles["post-content"]}>
                        <h3>{post.name}</h3>
                        {editingPostId !== post.id ? (
                          <p className={styles["post-description"]} onClick={() => { setEditingPostId(post.id); setEditDescription(post.description || ""); }}>
                            {post.description || "Tap to add description..."}
                          </p>
                        ) : (
                          <textarea
                            className={styles["post-description-input"]}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            onBlur={() => saveDescription(post)}
                          />
                        )}
                        <p className={styles["post-status"]}>
                          Status: <span className={`${styles["status-badge"]} ${styles[`status-${post.status}`] || ""}`}>{post.status}</span>
                        </p>
                        {post.status === "pending" && (
                          <div className={styles["post-actions"]}>
                            <button type="button" className={styles["approve-btn"]} onClick={() => handleApprove(post.id)}>✓ Approve</button>
                            <button type="button" className={styles["deny-btn"]} onClick={() => handleDeny(post.id)}>✗ Deny</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className={styles["modal-overlay"]} onClick={() => setSelectedOrder(null)}>
          <div className={styles["modal-content"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <div className={styles["modal-title"]}>
                <h3>Order Details</h3>
                <span className={styles["order-badge"]}>#{selectedOrder.id.slice(-8)}</span>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className={styles["close-btn"]}>&times;</button>
            </div>
            <div className={styles["modal-body"]}>
              <div className={styles["order-details"]}>
                <div className={styles["detail-section"]}>
                  <h4>Customer Information</h4>
                  <p><strong>Name:</strong> {selectedOrder.customer_name}</p>
                  <p><strong>Email:</strong> {selectedOrder.customer_email}</p>
                  <p><strong>Phone:</strong> {selectedOrder.customer_phone}</p>
                </div>
                <div className={styles["detail-section"]}>
                  <h4>Shipping Address</h4>
                  <p><strong>Street:</strong> {selectedOrder.address_street}</p>
                  <p><strong>City:</strong> {selectedOrder.address_city}, {selectedOrder.address_state} {selectedOrder.address_zip}</p>
                </div>
                <div className={styles["detail-section"]}>
                  <h4>Order Items</h4>
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className={styles["item-detail"]}>
                      <p><strong>{item.productType === "sticker" ? "Custom Stickers" : "Mylar Bags"}</strong> — ${item.subtotal.toFixed(2)}</p>
                      <p>Qty: {item.quantity} | Unit: ${item.unitPrice.toFixed(2)}</p>
                      {item.designFileUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.designFileUrl} alt="Design" className={styles["design-image"]} />
                      )}
                    </div>
                  ))}
                </div>
                <div className={styles["detail-section"]}>
                  <h4>Order Information</h4>
                  <p><button type="button" onClick={() => openApprovals(selectedOrder.id)} className={styles["view-btn"]}>Create / review artwork approval</button></p>
                  <p><strong>Date:</strong> {formatDate(selectedOrder.created_at)}</p>
                  <p><strong>Status:</strong> {selectedOrder.status}</p>
                  <p><strong>Total:</strong> ${selectedOrder.total.toFixed(2)}</p>
                  <p><strong>Notes:</strong> {selectedOrder.order_notes || "No notes provided"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className={styles["modal-overlay"]} onClick={() => setSelectedImage(null)}>
          <div className={styles["image-modal-content"]} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSelectedImage(null)} className={`${styles["close-btn"]} ${styles["image-close"]}`}>&times;</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImage} alt="Full size post" className={styles["full-size-image"]} />
          </div>
        </div>
      )}
    </div>
  );
}
