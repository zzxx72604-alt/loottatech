import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ORDERS_URL, ORDER_CREATE_URL, ORDER_NEW_FOR_CURRENT_USER_URL, ORDER_PAY_URL, ORDER_TRACK_URL } from '../shared/constants/urls';
import { Order } from '../shared/models/Order';

@Injectable({
  providedIn: 'root'
})
export class OrderService {


  constructor(private http: HttpClient) { }

  create(order:Order){
    return this.http.post<Order>(ORDER_CREATE_URL, order);
  }

  getNewOrderForCurrentUser():Observable<Order>{
    return this.http.get<Order>(ORDER_NEW_FOR_CURRENT_USER_URL);
  }

  pay(order:Order):Observable<string>{
    return this.http.post<string>(ORDER_PAY_URL,order);
  }

  getAll(): Observable<Order[]>{
    return this.http.get<Order[]>(ORDERS_URL);
  }

  deleteOrder(id:string){
    return this.http.delete(ORDERS_URL + '/' + id, {responseType:'text'});
  }

  restoreOrder(id:string){
    return this.http.put(ORDERS_URL + '/restore/' + id, {}, {responseType:'text'});
  }

  getAllOrders(): Observable<Order[]>{
    return this.http.get<Order[]>(ORDERS_URL + '/all');
  }

  completeOrder(id:string){
    return this.http.put(ORDERS_URL + '/complete/' + id, {}, {responseType:'text'});
  }

  trackOrderById(id:number): Observable<Order>{
    return this.http.get<Order>(ORDER_TRACK_URL + id);
  }

}
