use super::network::Network;
#[cfg(test)]
use super::PORTAL_HOST;
use crate::common::CliResult;
use hickory_proto::op::{Message, MessageType, OpCode, Query, ResponseCode};
use hickory_proto::rr::{Name, RData, RecordType};
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::time::{Duration, Instant};

pub(super) fn resolve(network: &Network, host: &str, deadline: Instant) -> CliResult<Ipv4Addr> {
    let mut failures = Vec::new();
    for server in network.dns.iter().take(3) {
        if let Err(error) = network.ensure_route(*server) {
            failures.push(error);
            continue;
        }
        let timeout = deadline
            .saturating_duration_since(Instant::now())
            .min(Duration::from_secs(2));
        if timeout.is_zero() {
            break;
        }
        match query(
            network.address,
            SocketAddr::from((*server, 53)),
            Some(&network.interface),
            host,
            timeout,
        ) {
            Ok(address) => return Ok(address),
            Err(error) => failures.push(format!("{server}: {error}")),
        }
    }
    Err(format!(
        "Wi-Fi DNS could not resolve {host}: {}",
        failures.join("; ")
    ))
}

fn query(
    local: Ipv4Addr,
    server: SocketAddr,
    interface: Option<&str>,
    host: &str,
    timeout: Duration,
) -> CliResult<Ipv4Addr> {
    let socket = socket2::Socket::new(
        socket2::Domain::IPV4,
        socket2::Type::DGRAM,
        Some(socket2::Protocol::UDP),
    )
    .map_err(|error| format!("Could not create Wi-Fi DNS socket: {error}"))?;
    if let Some(interface) = interface {
        bind_interface(&socket, interface)?;
    }
    socket
        .bind(&SocketAddr::from((local, 0)).into())
        .map_err(|error| format!("Could not bind Wi-Fi DNS address: {error}"))?;
    let socket: UdpSocket = socket.into();
    socket
        .set_read_timeout(Some(timeout))
        .map_err(|_| "Could not set DNS timeout.")?;
    socket
        .set_write_timeout(Some(timeout))
        .map_err(|_| "Could not set DNS timeout.")?;
    socket
        .connect(server)
        .map_err(|_| "Could not reach campus DNS server.")?;
    let mut request = Message::new(rand::random(), MessageType::Query, OpCode::Query);
    request.metadata.recursion_desired = true;
    request.add_query(Query::query(
        Name::from_ascii(format!("{host}.")).map_err(|_| "Invalid portal DNS name.")?,
        RecordType::A,
    ));
    let bytes = request
        .to_vec()
        .map_err(|_| "Could not encode DNS query.")?;
    socket
        .send(&bytes)
        .map_err(|_| "Campus DNS query failed.")?;
    let mut buffer = [0; 4096];
    let size = socket
        .recv(&mut buffer)
        .map_err(|_| "Campus DNS query timed out.")?;
    let response = Message::from_vec(&buffer[..size])
        .map_err(|_| "Campus DNS returned a malformed response.")?;
    address_from_response(&request, &response)
}

fn bind_interface(socket: &socket2::Socket, interface: &str) -> CliResult<()> {
    #[cfg(target_os = "linux")]
    socket
        .bind_device(Some(interface.as_bytes()))
        .map_err(|error| format!("Could not bind DNS to Wi-Fi interface {interface}: {error}"))?;
    #[cfg(target_os = "macos")]
    {
        let name =
            std::ffi::CString::new(interface).map_err(|_| "Invalid Wi-Fi interface name.")?;
        // The OS reads this NUL-terminated name only for the duration of the call.
        let index = unsafe { libc::if_nametoindex(name.as_ptr()) };
        let index = std::num::NonZeroU32::new(index).ok_or("Wi-Fi interface no longer exists.")?;
        socket
            .bind_device_by_index_v4(Some(index))
            .map_err(|error| {
                format!("Could not bind DNS to Wi-Fi interface {interface}: {error}")
            })?;
    }
    #[cfg(target_os = "windows")]
    let _ = (socket, interface); // The source address and route guard select the adapter.
    Ok(())
}

fn address_from_response(request: &Message, response: &Message) -> CliResult<Ipv4Addr> {
    if response.metadata.id != request.metadata.id
        || response.metadata.message_type != MessageType::Response
        || response.metadata.op_code != OpCode::Query
        || response.metadata.response_code != ResponseCode::NoError
        || response.metadata.truncation
        || response.queries != request.queries
    {
        return Err("Campus DNS returned an unexpected or incomplete response.".into());
    }
    let mut name = request.queries[0].name().clone();
    // Follow only the queried name's CNAME chain; ignore unrelated answer records.
    for _ in 0..8 {
        for record in &response.answers {
            if record.name == name {
                if let RData::A(address) = record.data {
                    if !address.0.is_unspecified()
                        && !address.0.is_loopback()
                        && !address.0.is_multicast()
                    {
                        return Ok(address.0);
                    }
                }
            }
        }
        let alias = response.answers.iter().find_map(|record| {
            if record.name == name {
                if let RData::CNAME(alias) = &record.data {
                    return Some(alias.0.clone());
                }
            }
            None
        });
        let Some(alias) = alias else {
            break;
        };
        name = alias;
    }
    Err("Campus DNS returned no usable portal IPv4 address.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use hickory_proto::rr::{rdata::A, Record};
    #[test]
    fn queries_wifi_dns_and_validates_transaction() {
        let server = UdpSocket::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        server
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let address = server.local_addr().unwrap();
        let worker = std::thread::spawn(move || {
            let mut buffer = [0; 4096];
            let (size, peer) = server.recv_from(&mut buffer).unwrap();
            let request = Message::from_vec(&buffer[..size]).unwrap();
            let mut response = Message::response(request.metadata.id, OpCode::Query);
            response.queries = request.queries;
            response.add_answer(Record::from_rdata(
                Name::from_ascii(format!("{PORTAL_HOST}.")).unwrap(),
                60,
                RData::A(A(Ipv4Addr::new(10, 2, 0, 1))),
            ));
            server.send_to(&response.to_vec().unwrap(), peer).unwrap();
        });
        assert_eq!(
            query(
                Ipv4Addr::LOCALHOST,
                address,
                None,
                PORTAL_HOST,
                Duration::from_secs(2)
            )
            .unwrap(),
            Ipv4Addr::new(10, 2, 0, 1)
        );
        worker.join().unwrap();
    }
    #[test]
    fn rejects_wrong_id_and_unrelated_answers() {
        let mut request = Message::new(42, MessageType::Query, OpCode::Query);
        request.add_query(Query::query(
            Name::from_ascii(format!("{PORTAL_HOST}.")).unwrap(),
            RecordType::A,
        ));
        let mut response = Message::response(43, OpCode::Query);
        response.queries = request.queries.clone();
        response.add_answer(Record::from_rdata(
            Name::from_ascii("other.example").unwrap(),
            60,
            RData::A(A(Ipv4Addr::new(10, 2, 0, 1))),
        ));
        assert!(address_from_response(&request, &response).is_err());
        response.metadata.id = 42;
        assert!(address_from_response(&request, &response).is_err());
    }
}
