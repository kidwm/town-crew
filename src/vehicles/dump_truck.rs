use super::super::*;

const DUMP_TRUCK_WHEEL_RADIUS: f32 = 0.48;

#[derive(Component)]
pub(crate) struct DumpTruckRolling {
    previous_x: f32,
}

#[derive(Component)]
pub(crate) struct DumpTruckWheel {
    base_rotation: Quat,
    angle: f32,
}

pub(crate) fn spawn_dump_truck(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let truck_blue = unlit_material(materials, Color::srgb(0.05, 0.48, 0.83));
    let truck_blue_dark = unlit_material(materials, Color::srgb(0.03, 0.29, 0.56));
    let bed_orange = unlit_material(materials, Color::srgb(1.0, 0.50, 0.04));
    let tire = unlit_material(materials, Color::srgb(0.08, 0.09, 0.10));
    let hub = unlit_material(materials, Color::srgb(0.62, 0.66, 0.69));
    let window = unlit_material(materials, Color::srgb(0.36, 0.78, 0.88));
    let transparent_hitbox = materials.add(StandardMaterial {
        base_color: Color::srgba(1.0, 0.65, 0.12, 0.0),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });

    let truck = commands
        .spawn((
            DumpTruckVehicle,
            DumpTruckRolling {
                previous_x: DUMP_TRUCK_START_X,
            },
            Transform::from_xyz(DUMP_TRUCK_START_X, 0.0, 0.0),
            Visibility::Hidden,
        ))
        .id();

    commands.entity(truck).with_children(|parent| {
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(4.7, 0.42, 1.65))),
            MeshMaterial3d(truck_blue_dark.clone()),
            Transform::from_xyz(-0.85, 0.78, 0.0),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.55, 1.55, 1.55))),
            MeshMaterial3d(truck_blue.clone()),
            Transform::from_xyz(-2.20, 1.62, 0.0),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(0.90, 0.82, 0.05))),
            MeshMaterial3d(window),
            Transform::from_xyz(-1.98, 1.82, 0.80),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(0.62, 0.38, 1.50))),
            MeshMaterial3d(truck_blue.clone()),
            Transform::from_xyz(-1.18, 1.08, 0.0),
        ));

        let wheel_mesh = meshes.add(
            Cylinder::new(DUMP_TRUCK_WHEEL_RADIUS, 0.30)
                .mesh()
                .resolution(14),
        );
        let hub_mesh = meshes.add(Cylinder::new(0.24, 0.32).mesh().resolution(14));
        let wheel_marker_mesh = meshes.add(Cuboid::new(0.12, 0.04, 0.62));
        let cylinder_rotation = Quat::from_rotation_x(std::f32::consts::FRAC_PI_2);
        for x in [-2.10, 0.10] {
            for z in [-0.91, 0.91] {
                parent
                    .spawn((
                        DumpTruckWheel {
                            base_rotation: cylinder_rotation,
                            angle: 0.0,
                        },
                        Transform::from_xyz(x, 0.58, z).with_rotation(cylinder_rotation),
                        Visibility::default(),
                    ))
                    .with_children(|wheel| {
                        wheel.spawn((Mesh3d(wheel_mesh.clone()), MeshMaterial3d(tire.clone())));
                        wheel.spawn((
                            Mesh3d(hub_mesh.clone()),
                            MeshMaterial3d(hub.clone()),
                            Transform::from_xyz(0.0, z * 0.01, 0.0),
                        ));
                        wheel.spawn((
                            Mesh3d(wheel_marker_mesh.clone()),
                            MeshMaterial3d(hub.clone()),
                            Transform::from_xyz(0.0, z.signum() * 0.18, 0.0),
                        ));
                    });
            }
        }

        parent
            .spawn((
                DumpBed,
                Transform::from_translation(DUMP_BED_HOME),
                Visibility::default(),
            ))
            .with_children(|bed| {
                bed.spawn((
                    DumpBedHitbox,
                    Pickable::default(),
                    Mesh3d(meshes.add(Cuboid::new(2.4, 1.9, 2.25))),
                    MeshMaterial3d(transparent_hitbox.clone()),
                    Transform::from_xyz(-1.70, 0.05, 0.0),
                ))
                .observe(on_dump_bed_clicked)
                .observe(on_dump_bed_drag_start)
                .observe(on_dump_bed_drag)
                .observe(on_dump_bed_drag_end)
                .observe(on_dump_bed_pointer_cancel);
                bed.spawn((
                    Mesh3d(meshes.add(Cuboid::new(2.8, 0.24, 1.65))),
                    MeshMaterial3d(bed_orange.clone()),
                    Transform::from_xyz(-1.30, -0.20, 0.0),
                ));
                for z in [-0.76, 0.76] {
                    bed.spawn((
                        Mesh3d(meshes.add(Cuboid::new(2.8, 0.72, 0.16))),
                        MeshMaterial3d(bed_orange.clone()),
                        Transform::from_xyz(-1.30, 0.15, z),
                    ));
                }
                bed.spawn((
                    Mesh3d(meshes.add(Cuboid::new(0.20, 0.72, 1.65))),
                    MeshMaterial3d(bed_orange.clone()),
                    Transform::from_xyz(-2.62, 0.15, 0.0),
                ));

                let hint = bed
                    .spawn((
                        DumpBedHint,
                        Transform::from_xyz(-1.25, 1.15, 0.88),
                        Visibility::Hidden,
                    ))
                    .id();
                bed.commands().entity(hint).with_children(|hint_parent| {
                    let hint_mesh = meshes.add(Cuboid::new(0.62, 0.13, 0.12));
                    let hint_material = unlit_material(materials, Color::srgb(1.0, 0.94, 0.25));
                    for y in [0.0, 0.42] {
                        for (x, rotation) in [(-0.20, 0.72), (0.20, -0.72)] {
                            hint_parent.spawn((
                                Mesh3d(hint_mesh.clone()),
                                MeshMaterial3d(hint_material.clone()),
                                Transform::from_xyz(x, y, 0.0)
                                    .with_rotation(Quat::from_rotation_z(rotation)),
                            ));
                        }
                    }
                });
            });
    });
}

pub(crate) fn spawn_pit_fill(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let fill_material = unlit_material(materials, Color::srgb(0.72, 0.48, 0.22));
    let compacted_material = unlit_material(materials, Color::srgb(0.56, 0.35, 0.16));
    commands.spawn((
        PitFill {
            loose_material: fill_material.clone(),
            compacted_material,
        },
        Mesh3d(meshes.add(Cylinder::new(2.05, 0.16).mesh().resolution(16))),
        MeshMaterial3d(fill_material.clone()),
        Transform::from_xyz(2.25, 0.39, 0.0).with_scale(Vec3::new(0.05, 1.0, 0.05)),
        Visibility::Hidden,
    ));

    let gravel_mesh = meshes.add(Cuboid::new(0.34, 0.34, 0.34));
    for index in 0..7 {
        commands.spawn((
            GravelStream {
                offset: index as f32 / 7.0,
            },
            Mesh3d(gravel_mesh.clone()),
            MeshMaterial3d(fill_material.clone()),
            Transform::default(),
            Visibility::Hidden,
        ));
    }
}

pub(crate) fn on_dump_bed_clicked(
    event: On<Pointer<Click>>,
    mission: Res<Mission>,
    mut stage: ResMut<DumpTruckStage>,
) {
    if event.button == PointerButton::Primary
        && mission.phase == MissionPhase::DumpTruck
        && stage.action == DumpBedAction::Ready
    {
        stage.action = DumpBedAction::Resetting;
        stage.animation_elapsed = 0.0;
        stage.preview_tilt = DUMP_BED_TAP_TILT;
        info!("Dump bed tapped; lift hint played");
    }
}

pub(crate) fn on_dump_bed_drag_start(
    event: On<Pointer<DragStart>>,
    mission: Res<Mission>,
    mut stage: ResMut<DumpTruckStage>,
) {
    if event.button == PointerButton::Primary
        && mission.phase == MissionPhase::DumpTruck
        && stage.action == DumpBedAction::Ready
    {
        stage.action = DumpBedAction::Dragging;
        stage.preview_tilt = 0.0;
        info!("Dump bed drag started");
    }
}

pub(crate) fn on_dump_bed_drag(
    event: On<Pointer<Drag>>,
    mission: Res<Mission>,
    mut stage: ResMut<DumpTruckStage>,
) {
    if event.button != PointerButton::Primary
        || mission.phase != MissionPhase::DumpTruck
        || stage.action != DumpBedAction::Dragging
    {
        return;
    }

    let upward_distance = (-event.distance.y).max(0.0);
    let drag_progress = (upward_distance / DUMP_BED_DRAG_THRESHOLD).clamp(0.0, 1.0);
    stage.preview_tilt = DUMP_BED_DRAG_TILT * drag_progress;
    if drag_progress >= 1.0 {
        stage.action = DumpBedAction::Dumping;
        stage.animation_elapsed = 0.0;
        info!("Dump bed fully lifted by drag; automatic dump started");
    }
}

pub(crate) fn on_dump_bed_drag_end(event: On<Pointer<DragEnd>>, mut stage: ResMut<DumpTruckStage>) {
    if event.button == PointerButton::Primary && stage.action == DumpBedAction::Dragging {
        stage.action = DumpBedAction::Resetting;
        stage.animation_elapsed = 0.0;
        info!("Dump bed drag missed; ready for another try");
    }
}

pub(crate) fn on_dump_bed_pointer_cancel(
    _: On<Pointer<Cancel>>,
    mut stage: ResMut<DumpTruckStage>,
) {
    if stage.action == DumpBedAction::Dragging {
        stage.action = DumpBedAction::Resetting;
        stage.animation_elapsed = 0.0;
        info!("Dump bed pointer canceled; ready for another try");
    }
}

pub(crate) fn advance_to_dump_truck(
    time: Res<Time>,
    excavator_stage: Res<ExcavatorStage>,
    mut mission: ResMut<Mission>,
    mut dump_truck_stage: ResMut<DumpTruckStage>,
    mut excavator_visuals: Query<&mut Visibility, With<ExcavatorVisual>>,
    mut truck_visibility: Single<&mut Visibility, TruckTransitionFilter>,
    mut completion_visibility: Single<&mut Visibility, CompletionTransitionFilter>,
) {
    if mission.phase != MissionPhase::Excavator || excavator_stage.action != BucketAction::Complete
    {
        return;
    }

    mission.transition_elapsed += time.delta_secs();
    if mission.transition_elapsed < 0.85 {
        return;
    }

    for mut visibility in &mut excavator_visuals {
        *visibility = Visibility::Hidden;
    }
    **completion_visibility = Visibility::Hidden;
    **truck_visibility = Visibility::Visible;
    mission.phase = MissionPhase::DumpTruck;
    mission.transition_elapsed = 0.0;
    dump_truck_stage.action = DumpBedAction::Entering;
    dump_truck_stage.animation_elapsed = 0.0;
    info!("Dump truck stage started");
}

pub(crate) fn animate_dump_truck(
    time: Res<Time>,
    mission: Res<Mission>,
    mut stage: ResMut<DumpTruckStage>,
    mut visuals: DumpTruckVisuals,
) {
    if mission.phase != MissionPhase::DumpTruck {
        return;
    }

    match stage.action {
        DumpBedAction::Entering => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 1.15).clamp(0.0, 1.0);
            let eased = 1.0 - (1.0 - t) * (1.0 - t);
            visuals.truck.translation.x =
                DUMP_TRUCK_START_X + (DUMP_TRUCK_PARKED_X - DUMP_TRUCK_START_X) * eased;
            if t >= 1.0 {
                visuals.truck.translation.x = DUMP_TRUCK_PARKED_X;
                stage.action = DumpBedAction::Ready;
                stage.animation_elapsed = 0.0;
                info!("Dump truck parked; dump bed ready");
            }
        }
        DumpBedAction::Ready => {
            visuals.bed.rotation = Quat::IDENTITY;
        }
        DumpBedAction::Dragging => {
            visuals.bed.rotation = Quat::from_rotation_z(stage.preview_tilt);
        }
        DumpBedAction::Resetting => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 0.28).clamp(0.0, 1.0);
            let eased = t * t * (3.0 - 2.0 * t);
            visuals.bed.rotation = Quat::from_rotation_z(stage.preview_tilt * (1.0 - eased));
            if t >= 1.0 {
                visuals.bed.rotation = Quat::IDENTITY;
                stage.preview_tilt = 0.0;
                stage.action = DumpBedAction::Ready;
                stage.animation_elapsed = 0.0;
            }
        }
        DumpBedAction::Dumping => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 1.70).clamp(0.0, 1.0);
            let tilt_t = (t / 0.24).clamp(0.0, 1.0);
            let tilt_eased = 1.0 - (1.0 - tilt_t) * (1.0 - tilt_t);
            let tilt = stage.preview_tilt + (DUMP_BED_MAX_TILT - stage.preview_tilt) * tilt_eased;
            visuals.bed.rotation = Quat::from_rotation_z(tilt);

            let fill_progress = ((t - 0.22) / 0.52).clamp(0.0, 1.0);
            let (fill_transform, fill_visibility) = &mut *visuals.pit_fill;
            if fill_progress > 0.0 {
                **fill_visibility = Visibility::Visible;
                fill_transform.scale =
                    Vec3::new(fill_progress.max(0.05), 1.0, fill_progress.max(0.05));
            }

            let pouring = (0.18..=0.78).contains(&t);
            let stream_start = visuals.truck.translation + Vec3::new(1.30, 1.48, 0.0);
            let stream_end = Vec3::new(2.15, 0.52, 0.0);
            for (particle, mut transform, mut visibility) in &mut visuals.gravel {
                *visibility = if pouring {
                    Visibility::Visible
                } else {
                    Visibility::Hidden
                };
                if pouring {
                    let progress = (particle.offset + stage.animation_elapsed * 1.85).fract();
                    transform.translation = stream_start.lerp(stream_end, progress);
                    transform.translation.z =
                        (particle.offset * std::f32::consts::TAU).sin() * 0.28;
                    transform.rotation = Quat::from_rotation_z(progress * 3.0);
                }
            }

            if t >= 1.0 {
                stage.action = DumpBedAction::Returning;
                stage.animation_elapsed = 0.0;
                stage.preview_tilt = DUMP_BED_MAX_TILT;
                for (_, _, mut visibility) in &mut visuals.gravel {
                    *visibility = Visibility::Hidden;
                }
            }
        }
        DumpBedAction::Returning => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 0.58).clamp(0.0, 1.0);
            let eased = t * t * (3.0 - 2.0 * t);
            visuals.bed.rotation = Quat::from_rotation_z(DUMP_BED_MAX_TILT * (1.0 - eased));
            if t >= 1.0 {
                visuals.bed.rotation = Quat::IDENTITY;
                stage.action = DumpBedAction::Complete;
                stage.animation_elapsed = 0.0;
                **visuals.completion_visibility = Visibility::Visible;
                info!("Dump truck stage complete");
            }
        }
        DumpBedAction::Waiting | DumpBedAction::Complete => {}
    }
}

pub(crate) fn animate_dump_truck_wheels(
    mut truck: Single<
        (&Transform, &mut DumpTruckRolling),
        (With<DumpTruckVehicle>, Without<DumpTruckWheel>),
    >,
    mut wheels: Query<(&mut Transform, &mut DumpTruckWheel), Without<DumpTruckVehicle>>,
) {
    let (truck_transform, rolling) = &mut *truck;
    let distance = truck_transform.translation.x - rolling.previous_x;
    rolling.previous_x = truck_transform.translation.x;

    if distance == 0.0 {
        return;
    }

    for (mut transform, mut wheel) in &mut wheels {
        wheel.angle =
            (wheel.angle - distance / DUMP_TRUCK_WHEEL_RADIUS).rem_euclid(std::f32::consts::TAU);
        transform.rotation = wheel.base_rotation * Quat::from_rotation_y(wheel.angle);
    }
}

pub(crate) fn pulse_dump_bed(
    time: Res<Time>,
    mission: Res<Mission>,
    stage: Res<DumpTruckStage>,
    mut hint: Single<(&mut Transform, &mut Visibility), With<DumpBedHint>>,
) {
    let ready = mission.phase == MissionPhase::DumpTruck && stage.action == DumpBedAction::Ready;
    let wave = hint_wave(&time, 5.0, 0.0);
    let (transform, visibility) = &mut *hint;
    **visibility = if ready {
        Visibility::Visible
    } else {
        Visibility::Hidden
    };
    transform.translation = Vec3::new(-1.25, 1.15 + wave * 0.28, 0.88);
    transform.scale = Vec3::splat(0.92 + wave * 0.14);
}

pub(crate) fn reset_dump_truck(
    restart: Res<RestartRequest>,
    mut commands: Commands,
    truck_entity: Single<Entity, With<DumpTruckVehicle>>,
    mut visuals: DumpTruckVisuals,
    mut rolling: Single<&mut DumpTruckRolling, With<DumpTruckVehicle>>,
    mut wheels: Query<
        (&mut Transform, &mut DumpTruckWheel),
        (
            Without<DumpTruckVehicle>,
            Without<DumpBed>,
            Without<PitFill>,
            Without<GravelStream>,
        ),
    >,
) {
    if !restart.0 {
        return;
    }

    commands.entity(*truck_entity).insert(Visibility::Hidden);
    **visuals.truck = Transform::from_xyz(DUMP_TRUCK_START_X, 0.0, 0.0);
    **visuals.bed = Transform::from_translation(DUMP_BED_HOME);
    rolling.previous_x = DUMP_TRUCK_START_X;
    for (mut transform, mut wheel) in &mut wheels {
        wheel.angle = 0.0;
        transform.rotation = wheel.base_rotation;
    }
    for (_, mut transform, mut visibility) in &mut visuals.gravel {
        *transform = Transform::default();
        *visibility = Visibility::Hidden;
    }
}
