package com.example.monitoreo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.example.repository.EntregaRepository;
import com.example.repository.PedidoRepository;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.MeterBinder;

@Component
public class MetricasNegocio implements MeterBinder {

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private EntregaRepository entregaRepository;

    @Override
    public void bindTo(MeterRegistry registro) {
        registro.counter("dolcevita.pedidos.creados", "modalidad", "Delivery");
        registro.counter("dolcevita.pedidos.creados", "modalidad", "Recojo");
        registro.counter("dolcevita.pedidos.cancelados");
        registro.counter("dolcevita.pedidos.entregados");
        registro.counter("dolcevita.pedidos.rechazados");
        registro.timer("dolcevita.pedidos.tiempo_registro");
        registro.counter("dolcevita.entregas.asignadas");
        registro.counter("dolcevita.entregas.iniciadas");
        registro.counter("dolcevita.entregas.completadas");
        registro.counter("dolcevita.entregas.incidencias");
        registro.counter("dolcevita.login.exitosos");
        registro.counter("dolcevita.login.fallidos");

        Gauge.builder("dolcevita.pedidos.pendientes", pedidoRepository,
                        repo -> repo.findByEstadoIgnoreCase("PENDIENTE").size())
                .description("Pedidos que esperan ser confirmados")
                .register(registro);

        Gauge.builder("dolcevita.pedidos.listos", pedidoRepository,
                        repo -> repo.findByEstadoIgnoreCase("LISTO").size())
                .description("Pedidos listos para entregar o recoger")
                .register(registro);

        Gauge.builder("dolcevita.entregas.en_curso", entregaRepository,
                        repo -> repo.findAll().stream().filter(e -> e.getEstado() == 1).count())
                .description("Entregas que estan en camino")
                .register(registro);

        Gauge.builder("dolcevita.entregas.con_incidencia", entregaRepository,
                        repo -> repo.findAll().stream().filter(e -> e.getEstado() == 3).count())
                .description("Entregas con incidencia registrada")
                .register(registro);
    }
}
